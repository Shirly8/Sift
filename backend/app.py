"""
Routes:
  GET  /api/health-check      — liveness probe
  POST /api/upload             — upload CSV, run ingestion + categorization (fast, no analysis)
  POST /api/analyze            — run full agent analysis on uploaded session
  POST /api/ask                — conversational follow-up (agent-style, not chatbot)
  POST /api/correct-category   — learn from user category correction
"""

import io
import os
import sys
import time
import uuid
import json
import queue
import threading
import pandas as pd
from flask import Flask, request, jsonify, Response
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(__file__))

from Ingestion.format_detector       import detect_csv_format, validate_csv_structure, normalize_to_standard
from Ingestion.normalizer            import clean_merchant_name, deduplicate_transactions, validate_date_range, calculate_data_quality_score
from Categorization.rule_categorizer import build_rule_engine, batch_categorize
from Categorization.merchant_db      import lookup_merchant, load_merchant_db, update_from_user_correction, _save_db, DB_PATH
from Categorization.llm_categorizer  import batch_categorize_llm, CATEGORIES
from Agent.orchestrator              import run as run_agent
from Agent.synthesizer               import synthesize_insights, generate_savings_plan
from Agent.conversational            import ask as agent_ask
from LLM.client                      import call_llm


####################################
# APP SETUP
####################################

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024   # 10 MB — prevents memory exhaustion from huge uploads

CORS(app, origins=os.getenv("ALLOWED_ORIGIN", "http://localhost:3000"))

limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[],          # no global limit — set per route
    storage_uri="memory://",
)

# trust proxy headers (Railway, Heroku, etc.) so rate limiting works behind a reverse proxy
app.config["RATELIMIT_HEADERS_ENABLED"] = True

_rules          = build_rule_engine()
_sessions       = {}            # session_id -> {df, analysis_results, created_at}
_sessions_lock  = threading.Lock()
MAX_SESSIONS    = 50
SESSION_TTL     = 3600          # 1 hour — sessions expire after this


####################################
# HELPER: JSON SERIALIZATION
####################################

def serialize_for_json(obj):
    """Convert pandas/numpy types to JSON-serializable Python types."""
    import numpy as np

    if isinstance(obj, dict):
        return {k: serialize_for_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [serialize_for_json(item) for item in obj]
    elif pd.isna(obj):
        return None
    elif isinstance(obj, (np.integer, np.floating, np.bool_)):
        return obj.item()
    elif isinstance(obj, (pd.Timestamp, pd.Timedelta)):
        return str(obj)
    else:
        return obj


####################################
# HELPER: SESSION MANAGEMENT
####################################

def _evict_expired_sessions():
    """Remove sessions older than SESSION_TTL. Call inside _sessions_lock."""
    now = time.time()
    expired = [sid for sid, s in _sessions.items() if now - s["created_at"] > SESSION_TTL]
    for sid in expired:
        del _sessions[sid]
    if expired:
        print(f"Evicted {len(expired)} expired sessions")


def _get_session(session_id: str) -> dict:
    """Thread-safe session lookup with TTL eviction."""
    with _sessions_lock:
        _evict_expired_sessions()
        session = _sessions.get(session_id)
        if session and time.time() - session["created_at"] > SESSION_TTL:
            del _sessions[session_id]
            return None
        return session


def _store_session(session_id: str, data: dict):
    """Thread-safe session storage with capacity eviction."""
    with _sessions_lock:
        _evict_expired_sessions()
        if len(_sessions) >= MAX_SESSIONS:
            oldest = min(_sessions, key=lambda k: _sessions[k]["created_at"])
            del _sessions[oldest]
        _sessions[session_id] = data


def _update_session(session_id: str, key: str, value):
    """Thread-safe session field update."""
    with _sessions_lock:
        if session_id in _sessions:
            _sessions[session_id][key] = value



####################################
# ROUTES
####################################

@app.route("/api/health-check", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


@app.route("/api/upload", methods=["POST"])
@limiter.limit("30 per day")
def upload():
    """
    Accepts a CSV file, runs ingestion + rule categorization.
    Fast path — NO analysis here. Analysis runs in /api/analyze.

      POST (multipart file)
      -> {"session_id": "...", "summary": {...}}
    """

    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    file = request.files["file"]

    if not file.filename.endswith(".csv"):
        return jsonify({"error": "Only CSV files are supported"}), 400


    # read into memory — never touch disk
    raw_bytes = file.stream.read()

    # UTF-8 first, latin-1 fallback for bank exports with special chars
    try:
        content = raw_bytes.decode("utf-8")
    except UnicodeDecodeError:
        content = raw_bytes.decode("latin-1")

    csv_buffer = io.StringIO(content)


    try:
        format_type = detect_csv_format(io.StringIO(content))
        df_raw      = pd.read_csv(csv_buffer)

        validate_csv_structure(df_raw, format_type)
        df = normalize_to_standard(df_raw, format_type)

        # clean + validate
        df["merchant"] = df["merchant"].apply(clean_merchant_name)
        df             = deduplicate_transactions(df)
        start, end     = validate_date_range(df)
        quality_score  = calculate_data_quality_score(df)

        # rule categorization
        result           = batch_categorize(df["merchant"].tolist(), _rules)
        df["category"]   = result["category"].values
        df["confidence"] = result["confidence"].values

        # check merchant cache for uncategorized — load once, not per row
        db = load_merchant_db()

        for i, row in df[df["category"].isna()].iterrows():
            cat, conf, _ = lookup_merchant(row["merchant"], db=db)
            if cat:
                df.at[i, "category"]   = cat
                df.at[i, "confidence"] = conf

        # split: categorized vs needs LLM
        needs_llm   = df[df["category"].isna() | (df["confidence"] < 0.7)]["merchant"].unique().tolist()
        categorized = int(df["category"].notna().sum())


        # batch cache save — reuse the db we already loaded
        changed = False

        for _, row in df[df["confidence"] >= 0.8].iterrows():
            key = row["merchant"].upper()
            if key not in db or not db.get(key, {}).get("user_verified"):
                db[key] = {
                    "category":      row["category"],
                    "confidence":    float(row["confidence"]),
                    "last_verified": pd.Timestamp.now().strftime("%Y-%m-%d"),
                    "user_verified": False,
                }
                changed = True

        if changed:
            _save_db(db, DB_PATH)


        # store session — analysis runs separately in /api/analyze
        session_id = str(uuid.uuid4())

        _store_session(session_id, {
            "df":               df,
            "analysis_results": None,
            "created_at":       time.time(),
        })

        response_data = {
            "status":       "success",
            "session_id":   session_id,
            "format_type":  format_type,
            "summary": {
                "total":        len(df),
                "categorized":  categorized,
                "needs_llm":    len(needs_llm),
                "coverage_pct": round(categorized / len(df) * 100, 1) if len(df) else 0,
                "quality_score": float(quality_score),
                "date_range": {
                    "start": str(start.date()),
                    "end":   str(end.date()),
                    "days":  int((end - start).days),
                },
            },
        }
        return jsonify(serialize_for_json(response_data))

    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Processing failed: {str(e)}"}), 500



@app.route("/api/analyze", methods=["POST"])
@limiter.limit("20 per day")
def analyze():
    """
    Runs the full agent analysis pipeline.
    Uses session_id from /upload, or accepts raw transactions.

      POST {"session_id": "..."}
      -> {"tools_run": [...], "insights": [...], "profile": {...}}
    """

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400


    # thread-safe session lookup
    session_id = data.get("session_id")
    if session_id:
        session = _get_session(session_id)
        if session:
            df = session["df"]
        else:
            return jsonify({"error": "Session expired — please re-upload your file", "session_expired": True}), 400
    elif "transactions" in data:
        df = pd.DataFrame(data["transactions"])
    else:
        return jsonify({"error": "Provide session_id or transactions"}), 400


    try:
        # auto-categorize any uncategorized transactions before analysis
        uncategorized_mask = df["category"].fillna("").eq("") | df["category"].isna()
        if uncategorized_mask.any():
            print(f"Auto-categorizing {uncategorized_mask.sum()} uncategorized transactions...")

            uncategorized_merchants = df[uncategorized_mask]["merchant"].unique().tolist()
            if uncategorized_merchants:
                try:
                    llm_results = batch_categorize_llm(uncategorized_merchants)

                    # apply LLM results back to DataFrame
                    for _, row in llm_results.iterrows():
                        merchant_mask = df["merchant"] == row["merchant"]
                        df.loc[merchant_mask, "category"] = row["category"]
                        df.loc[merchant_mask, "confidence"] = row.get("confidence", 0.5)

                    still_uncategorized = df["category"].fillna("").eq("") | df["category"].isna()
                    newly_categorized = uncategorized_mask & ~still_uncategorized
                    print(f"  Categorized {newly_categorized.sum()} transactions via LLM")

                except Exception as e:
                    print(f"  LLM categorization failed: {e} — proceeding with available data")

        # orchestrator: profile -> plan -> execute tools
        results = run_agent(df)

        # synthesizer: tool outputs -> ranked insights
        results["insights"] = synthesize_insights(
            results["results"], results["profile"], call_llm,
        )

        # savings plan: concrete opportunities from analysis + transaction data
        results["savings_plan"] = generate_savings_plan(df, results["results"])

        # persist so /api/ask can access without re-running
        if session_id:
            _update_session(session_id, "analysis_results", results)

        return jsonify(serialize_for_json(results))

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500



@app.route("/api/analyze-stream", methods=["GET"])
@limiter.limit("20 per day")
def analyze_stream():
    """
    SSE endpoint — streams real-time progress as each analysis tool runs.

      GET /api/analyze-stream?session_id=...
      -> text/event-stream with progress events, final event contains full results
    """

    session_id = request.args.get("session_id")
    if not session_id:
        return jsonify({"error": "session_id required"}), 400

    session = _get_session(session_id)
    if not session:
        return jsonify({"error": "Session expired — please re-upload your file", "session_expired": True}), 400

    df = session["df"].copy()

    def generate():
        q = queue.Queue()

        def on_progress(event):
            q.put(event)

        result_holder = [None]
        error_holder = [None]

        def run_analysis():
            try:
                # LLM categorization (if needed)
                uncategorized_mask = df["category"].fillna("").eq("") | df["category"].isna()
                if uncategorized_mask.any():
                    q.put({"step": "Categorizing merchants..."})

                    uncategorized_merchants = df[uncategorized_mask]["merchant"].unique().tolist()
                    if uncategorized_merchants:
                        try:
                            llm_results = batch_categorize_llm(uncategorized_merchants)
                            for _, row in llm_results.iterrows():
                                merchant_mask = df["merchant"] == row["merchant"]
                                df.loc[merchant_mask, "category"] = row["category"]
                                df.loc[merchant_mask, "confidence"] = row.get("confidence", 0.5)
                        except Exception as e:
                            print(f"  LLM categorization failed: {e}")

                # orchestrator: profile -> plan -> execute tools (emits {"step": "..."} via callback)
                results = run_agent(df, on_progress=on_progress)

                # synthesizer: tool outputs -> ranked insights
                q.put({"step": "Generating insights..."})
                results["insights"] = synthesize_insights(
                    results["results"], results["profile"], call_llm,
                )

                # savings plan: concrete opportunities from analysis + transaction data
                results["savings_plan"] = generate_savings_plan(df, results["results"])

                # persist so /api/ask can access without re-running
                _update_session(session_id, "analysis_results", results)

                result_holder[0] = results

            except Exception as e:
                error_holder[0] = e
            finally:
                q.put(None)  # sentinel

        thread = threading.Thread(target=run_analysis)
        thread.start()

        while True:
            event = q.get()
            if event is None:
                break
            yield f"data: {json.dumps(serialize_for_json(event))}\n\n"

        if error_holder[0]:
            yield f"data: {json.dumps({'error': str(error_holder[0])})}\n\n"
        else:
            yield f"data: {json.dumps(serialize_for_json({'done': True, 'data': result_holder[0]}))}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )



@app.route("/api/ask", methods=["POST"])
@limiter.limit("50 per day")
def ask_question():
    """
    Conversational follow-up — agent picks tools, runs computations, explains results.
    Not a chatbot. The agent USES TOOLS on real transaction data.

      POST {"session_id": "...", "question": "What if I cancel Netflix?"}
      -> {"answer": "...", "tool_used": "...", "computation": {...}}
    """

    data = request.get_json()
    if not data:
        return jsonify({"error": "No JSON body provided"}), 400

    question = data.get("question", "").strip()
    if not question:
        return jsonify({"error": "No question provided"}), 400


    # thread-safe session lookup
    session_id = data.get("session_id")
    if session_id:
        session = _get_session(session_id)
        if session:
            df               = session["df"]
            analysis_results = session.get("analysis_results")
        else:
            return jsonify({"error": "Session expired — please re-upload your file", "session_expired": True}), 400
    elif "transactions" in data:
        df               = pd.DataFrame(data["transactions"])
        analysis_results = None
    else:
        return jsonify({"error": "Provide session_id or transactions"}), 400


    try:
        result = agent_ask(question, df, analysis_results)
        return jsonify(serialize_for_json(result))

    except Exception as e:
        return jsonify({"error": f"Agent failed: {str(e)}"}), 500



@app.route("/api/correct-category", methods=["POST"])
def correct_category():
    """
    Learn from user category corrections.

      POST {"merchant": "SP * ETSY", "category": "Shopping"}
      -> {"status": "learned"}
    """

    data = request.get_json()

    merchant = (data.get("merchant") or "").strip()
    category = (data.get("category") or "").strip()

    if not merchant or not category:
        return jsonify({"error": "merchant and category required"}), 400

    # input validation: length limits and allowed categories
    if len(merchant) > 100:
        return jsonify({"error": "Merchant name too long (max 100 characters)"}), 400

    if category not in CATEGORIES:
        return jsonify({"error": f"Invalid category. Must be one of: {', '.join(CATEGORIES)}"}), 400

    update_from_user_correction(merchant, category)

    return jsonify({"status": "learned", "merchant": merchant, "category": category})



####################################
# ENTRY POINT
####################################

if __name__ == "__main__":
    app.run(
        host  = "0.0.0.0",
        port  = int(os.getenv("PORT", 5001)),
        debug = os.getenv("FLASK_ENV") == "development",
    )
