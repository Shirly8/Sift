"""
Routes:
  GET  /api/health-check      — liveness probe
  GET  /api/settings           — LLM provider info
  POST /api/upload             — upload CSV, run ingestion + categorization
  POST /api/analyze            — run full agent analysis on uploaded session
  POST /api/ask                — conversational follow-up (agent-style, not chatbot)
  POST /api/correct-category   — learn from user category correction
  POST /api/categorize-llm     — LLM fallback for uncategorized merchants
"""

import io
import os
import sys
import time
import uuid
import pandas as pd
from flask import Flask, request, jsonify
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
from Categorization.llm_categorizer  import batch_categorize_llm, validate_llm_confidence
from Agent.orchestrator              import run as run_agent
from Agent.synthesizer               import synthesize_insights
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

_rules    = build_rule_engine()
_sessions = {}                  # session_id -> {df, analysis_results, created_at}
MAX_SESSIONS = 50


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
# ROUTES
####################################

@app.route("/api/health-check", methods=["GET"])
def health_check():
    return jsonify({"status": "ok"})


@app.route("/api/settings", methods=["GET"])
def settings():
    return jsonify({
        "llm_provider": os.getenv("LLM_PROVIDER", "claude"),
        "model":        os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6"),
    })


@app.route("/api/upload", methods=["POST"])
@limiter.limit("30 per day")
def upload():
    """
    Accepts a CSV file, runs ingestion + rule categorization.
    Returns session_id for subsequent /analyze calls.

      POST (multipart file)
      -> {"session_id": "...", "transactions": [...], "summary": {...}}
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


        # run full analysis pipeline
        analysis = None
        try:
            analysis = run_agent(df)
            analysis["insights"] = synthesize_insights(
                analysis["results"], analysis["profile"], call_llm,
            )
        except Exception as e:
            print(f"Analysis failed during upload: {e}")

        # store session for /api/ask — evict oldest if over limit
        session_id = str(uuid.uuid4())

        if len(_sessions) >= MAX_SESSIONS:
            oldest = min(_sessions, key=lambda k: _sessions[k]["created_at"])
            del _sessions[oldest]

        _sessions[session_id] = {
            "df":               df,
            "analysis_results": analysis,
            "created_at":       time.time(),
        }

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
            "analysis": analysis,
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


    # session lookup first, fall back to raw transactions
    session_id = data.get("session_id")
    if session_id and session_id in _sessions:
        df = _sessions[session_id]["df"]
    elif session_id and session_id not in _sessions:
        return jsonify({"error": "Session expired — please re-upload your file", "session_expired": True}), 400
    elif "transactions" in data:
        df = pd.DataFrame(data["transactions"])
    else:
        return jsonify({"error": "Provide session_id or transactions"}), 400


    try:
        # auto-categorize any uncategorized transactions before analysis
        uncategorized_mask = df["category"].isna() | (df["category"] == "")
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

                    newly_categorized = (~uncategorized_mask) & (df["category"].notna() & (df["category"] != ""))
                    print(f"  ✓ Categorized {newly_categorized.sum()} transactions via LLM")

                except Exception as e:
                    print(f"  ⚠ LLM categorization failed: {e} — proceeding with available data")

        # orchestrator: profile -> plan -> execute tools
        results = run_agent(df)

        # synthesizer: tool outputs -> ranked insights
        results["insights"] = synthesize_insights(
            results["results"], results["profile"], call_llm,
        )

        # persist so /api/ask can access without re-running
        if session_id and session_id in _sessions:
            _sessions[session_id]["analysis_results"] = results

        return jsonify(serialize_for_json(results))

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500



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


    # session lookup first, fall back to raw transactions
    session_id = data.get("session_id")
    if session_id and session_id in _sessions:
        session = _sessions[session_id]
        df               = session["df"]
        analysis_results = session.get("analysis_results")
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

    merchant = data.get("merchant")
    category = data.get("category")

    if not merchant or not category:
        return jsonify({"error": "merchant and category required"}), 400

    update_from_user_correction(merchant, category)

    return jsonify({"status": "learned", "merchant": merchant, "category": category})



@app.route("/api/categorize-llm", methods=["POST"])
@limiter.limit("10 per day")
def categorize_llm():
    """
    LLM fallback for merchants the rule engine couldn't classify.

      POST {"merchants": ["AMZ*WHOLEFDS", "SP * ETSY"]}
      -> {"results": [...], "needs_review": [...]}
    """

    data      = request.get_json()
    merchants = data.get("merchants", [])

    if not merchants:
        return jsonify({"error": "No merchants provided"}), 400

    # cap at 50 to control LLM cost
    merchants = merchants[:50]

    results      = batch_categorize_llm(merchants)
    needs_review = validate_llm_confidence(results)

    response_data = {
        "results":      results.to_dict(orient="records"),
        "needs_review": needs_review.to_dict(orient="records"),
    }
    return jsonify(serialize_for_json(response_data))



####################################
# ENTRY POINT
####################################

if __name__ == "__main__":
    app.run(
        host  = "0.0.0.0",
        port  = int(os.getenv("PORT", 5001)),
        debug = os.getenv("FLASK_ENV") == "development",
    )
