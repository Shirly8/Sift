# Phase 1: Data Ingestion

<aside>

Input: CSV

```python
Date,Description,Amount,Type
2024-03-02,PURCHASE - LOBLAWS #1234 ON KING ST,$87.43,Debit
2024-03-03,PURCHASE - STARBUCKS #5678 ON QUEEN ST,$8.50,Debit
2024-03-03,PURCHASE - STARBUCKS #5678 ON QUEEN ST,$9.50,Debit
```

</aside>

### (1) [STARTPAGE.jsx → UploadModal.jsx → User Uploads a file → [`/upload`]

- Checks if file is actually a file and if it’s CSV file
- Encodes with UTF-8

### (2) **format_detector.py**  → Detects CSV format and normalizes schema

- `(a) detect_csv_format(csv_source)` Reads first 5 rows, matches headers against BANK_SCHEMAS, returns best match (Wealthsimple/RBC/TD/BMO) with 80% confidence threshold
- `(b) validate_csv_structure(df, format_type)` If required columns not present according to  BANK_SCEHMAS →  ValueError
- `(c) normalize_to_standard(df, format_type)` Maps bank columns to standard schema {date, amount, merchant}
    - `guess_columns` If generic → looks for other keywords [withdrawal → amount]
    - Dates → yyyy-mm-dd
    - Filter Types: SPEND-only for Wealthsimple
    - Amount: `_clean_amount(series)`   '$1,234.56' → '1234.56'
    - Missing date/amount → gone

```python
Output = DataFrame
  date        | amount |  merchant
	2024-03-02  | 87.43  |  PURCHASE - LOBLAWS #1234 ON KIN G
	2024-03-03  | 8.50   |  STARBUCKS - LO
	

```

### (3) `normalizer.py` → Cleans and validate data

- (a) **`clean_merchant_name(merchant)`**
    - Removes prefixes: ~~PURCHASE -~~ McDonalds
    - Removes Online: "AMAZON.COM*MX123456" → "AMAZON.COM"
    - Removes Location: STARBUCKS #1234 ON KING ST"`→`"STARBUCKS
- (b) **`deduplicate_transactions(df)`  →** Removes repeated transactions
    - Groups (date, amount, merchant) together (disgard if all 3 transaction the same)
- (c) **`validate_date_range`** → `(start_date, end_date)`
    - If it’s like only 7 days → it might be limited

# Phase 2: Categorization (Rules + Cache)

### (4) `rule_categorizer.py` → Rule-based categorization

- `batch_categorize()` → Processes all merchants at once
    - `build_rule_engine` → loads rules.json (400+ Canadian merchants)
    - `categorize_merchant(merchant, rules)` → checks against rules
        - `normalize()` → Removes punctuation (“WAL-MART” → “WALMART”)
        - Exact match: 0.95 confidence
        - Whole-word match: 0.80 confidence
        - Substring match: 0.70 confidence

**Rule Categorization Output:**

```python
    date       | amount  | merchant   | category   | confidence
2024-03-02 | 87.43   | LOBLAWS    | Groceries  | 0.95 ✅
2024-03-03 | 8.50    | STARBUCKS  | Dining     | 0.95 ✅
2024-03-03 | 9.50    | STARBUCKS  | Dining     | 0.95 ✅
```

### (5) Merchant Cache Lookup

- `lookup_merchant(merchant, db)` → Checks in-memory cache from previous uploads
- If found: uses cached category + confidence
- If not found: queues for LLM categorization

**Result after Phase 2:**
- ~70% categorized by rules
- ~20% from cache
- ~10% still need LLM (set aside for Phase 2: Analyze)

### (5) `llm_categorizer.py` → LLM fallback (deferred to Phase 2: Analyze)

**Note:** LLM categorization does NOT happen here. See Phase 2: Analyze for when/how it’s triggered.

### `/api/upload` Response

**Frontend (UploadModal.jsx State 3) receives:**

```python
{
  "status": "success",
  "session_id": "550e8400-e29b-41d4-a716-446655440000",
  "format_type": "Wealthsimple",
  "summary": {
    "total": 3,
    "categorized": 3,
    "needs_llm": 0,
    "coverage_pct": 100.0,
    "date_range": {
      "start": "2024-03-02",
      "end": "2024-03-03",
      "days": 1
    }
  }
}
```

# Phase 2: Analyze

**Flow:** UploadModal.jsx (State 3) → User clicks "Analyze My Spending" → Dashboard.jsx opens EventSource to `/api/analyze-stream?session_id=...`

---

## (6) `app.py` — Auto-Categorization of Uncategorized Merchants

**IMPORTANT: This does NOT happen during /upload. It only happens during /analyze-stream.**

If any transactions have `category == null` or `confidence < 0.7` from Phase 1 (/upload), they go through **batch LLM categorization** ONLY when the user clicks "Analyze My Spending" and triggers `/analyze-stream` (Phase 2).

This separation keeps `/upload` fast (rules only) and reserves expensive LLM calls for when the user explicitly requests analysis.

**Flow (app.py:75-109 → llm_categorizer.py):**

```python
# app.py wrapper
def _auto_categorize_with_llm(df: pd.DataFrame):
    """Auto-categorize uncategorized transactions via LLM."""
    uncategorized_mask = df["category"].fillna("").eq("") | df["category"].isna()
    if not uncategorized_mask.any():
        return df

    uncategorized_merchants = df[uncategorized_mask]["merchant"].unique().tolist()

    try:
        # Call batch_categorize_llm() from llm_categorizer.py (batches in groups of 10)
        llm_results = batch_categorize_llm(uncategorized_merchants)

        for _, row in llm_results.iterrows():
            merchant_mask = df["merchant"] == row["merchant"]
            df.loc[merchant_mask, "category"] = row["category"]
            df.loc[merchant_mask, "confidence"] = 0.75  # LLM is uncalibrated

        newly_categorized = uncategorized_mask & ~(df["category"].isna())
        print(f"Categorized {newly_categorized.sum()} transactions via LLM")
    except Exception as e:
        print(f"LLM categorization failed: {e}")

    return df
```

---

## `llm_categorizer.py` — Batch LLM Categorization

**Function: `batch_categorize_llm(uncategorized_merchants)`**

Takes BATCH_SIZE=10 of uncategorized merchants and calls LLM in batches:

**Prompt Template:**
```python
"""
Categorize each merchant into exactly one of: [CATEGORIES]

Merchants:
1. AMZ*WHOLEFDS
2. SP * ETSY
3. STARBUCKS #1234 ON

Return json array with {merchant, category, confidence}
"""
```

**Output:**
```json
[
  {"merchant": "AMZ*WHOLEFDS", "category": "Groceries", "confidence": 0.92},
  {"merchant": "SP * ETSY", "category": "Shopping", "confidence": 0.61},
  {"merchant": "STARBUCKS #1234 ON", "category": "Dining", "confidence": 0.95}
]
```

**Fallback:**
- If batch request fails: calls `categorize_with_llm(merchant)` individually
- If that fails: returns "Uncategorized"
- `extract_json()` strips markdown formatting before parsing

---

## `client.py` — LLM Provider Routing

**Auto-Detection:**
- `initialize_llm_client()` checks env vars for provider:
  - `ANTHROPIC_API_KEY` → Claude (Haiku 4.5 default)
  - `OPENAI_API_KEY` → OpenAI (GPT-4o-mini default)
  - `GEMINI_API_KEY` → Google Gemini (1.5-Flash default)
  - None → Ollama (llama3.1:8b default)

**Cost Tracking:**
- `_estimate_cost(input_tokens, output_tokens, model)` → calculates cost in dollars
- `_track_usage()` → accumulates session cost and tokens
- COST_WARN = $0.50 (prints warning)
- COST_ABORT = $1.00 (stops processing)

**Retry Strategy:**
- Exponential backoff: 1s, 2s, then fail after 3 attempts
- `call_llm(prompt, temperature=0.0, max_tokens=120)` returns response or None

---

## (7) Orchestrator: Plan Analysis

**Code (orchestrator.py:run() or equivalent):**

The orchestrator profiles the data and decides which tools to execute:

```python
def profile_data(df):
    """Extract profile from transaction DataFrame."""
    return {
        "transaction_count": len(df),
        "date_range": (df['date'].min(), df['date'].max()),
        "days_span": (df['date'].max() - df['date'].min()).days,
        "categories": df['category'].nunique(),
        "has_income": _detect_income(df),  # recurring deposits > avg transaction
    }

def plan_analysis(profile):
    """Decide which tools to run based on profile."""
    plan = {}

    if profile['days_span'] >= 90:
        plan['temporal_patterns'] = True  # Needs 90+ days
    if profile['transaction_count'] >= 100:
        plan['subscription_hunter'] = True  # Needs 100+ transactions
    if profile['days_span'] >= 180 and profile['categories'] >= 5:
        plan['spending_impact'] = True  # Needs 180+ days + 5+ categories
    if profile['days_span'] >= 90 and profile['categories'] >= 3:
        plan['correlation_engine'] = True  # Needs 90+ days + 3+ categories
    if profile['days_span'] >= 90 and profile['categories'] >= 3:
        plan['financial_resilience'] = True  # Needs 90+ days + 3+ categories

    plan['anomaly_detection'] = True  # Always run

    return plan
```

**Example Profile & Plan:**

```python
# Input: 3 transactions over 1 day
profile = {
    "transaction_count": 3,
    "date_range": ("2024-03-02", "2024-03-03"),
    "days_span": 1,
    "categories": 2,  # Groceries, Dining
    "has_income": False,
}

# Analysis Plan:
plan = {
    "anomaly_detection": True,  # Always
    "temporal_patterns": False,  # Needs 90+ days, have 1
    "subscription_hunter": False,  # Needs 100+ txns, have 3
    "spending_impact": False,  # Needs 180+ days + 5+ cats, have 1/0
    "correlation_engine": False,  # Needs 90+ days, have 1
    "financial_resilience": False,  # Needs 90+ days, have 1
}

# Orchestrator logs to frontend:
"Analyzing your spending...
 ✅ anomaly_detection (no minimum)
 ❌ temporal_patterns (needs 90+ days, have 1)
 ❌ subscription_hunter (needs 100+ transactions, have 3)
 ..."
```

---

## (8) Tool Execution (in Parallel)

Each enabled tool runs independently on the DataFrame. Example tools:

### temporal_patterns.py
```python
def analyze_temporal_patterns(df):
    """Detect payday, weekly, seasonal patterns."""
    return {
        "payday": {
            "payday_detected": True,
            "payday_offset": 3,  # days after deposit
            "spending_in_first_7_days_pct": 40,
        },
        "weekly": {
            "weekend_spending_multiple": 1.6,  # Sat/Sun vs weekday
        },
        "seasonal": {
            "seasonal_detected": True,
            "monthly_totals": {...},
        },
    }
```

### anomaly_detection.py
```python
def detect_anomalies(df):
    """Find outliers, spikes, new merchants."""
    return {
        "outliers": [
            {"merchant": "BEST BUY", "amount": 1247, "category_avg": 89},
        ],
        "spending_spikes": [
            {"category": "Dining", "month": "November", "amount": 890, "avg": 420},
        ],
        "new_merchants": [
            {"merchant": "FIGMA INC", "first_seen": "2024-10-15", "amount": 18},
        ],
    }
```

### subscription_hunter.py
```python
def find_subscriptions(df):
    """Find recurring charges, price creep, overlaps."""
    return {
        "recurring": [
            {"merchant": "NETFLIX", "category": "Subscriptions", "amount": 22.99, "frequency": "monthly"},
            {"merchant": "SPOTIFY", "category": "Subscriptions", "amount": 11.99, "frequency": "monthly"},
        ],
        "price_creep": [
            {"merchant": "NETFLIX", "original_price": 15.99, "current_price": 22.99, "total_increase_pct": 43.7},
        ],
        "overlaps": [
            {"category": "Subscriptions", "count": 2, "merchants": ["NETFLIX", "DISNEY+"]},
        ],
    }
```

---

## (9) Synthesizer: Rank Insights

**Code (synthesizer.py:synthesize_insights()):**

The synthesizer cross-references tool outputs to find compound patterns, then ranks by annual dollar impact:

```python
def synthesize_insights(tool_results, profile, call_llm):
    """Cross-reference tool outputs → ranked insights."""
    insights = []

    # Example: Subscription insight
    if tool_results.get('subscription_hunter'):
        subs = tool_results['subscription_hunter']
        total_annual = sum(s['amount'] * 12 for s in subs['recurring'])

        insights.append({
            "title": f"{len(subs['recurring'])} active subscriptions",
            "description": f"${total_annual}/year spent on recurring charges",
            "dollar_impact": total_annual,
            "confidence": "HIGH",
            "tool_source": "subscription_hunter",
        })

    # Example: Payday spike insight
    if tool_results.get('temporal_patterns'):
        temporal = tool_results['temporal_patterns']
        payday = temporal.get('payday', {})
        if payday.get('payday_detected'):
            insights.append({
                "title": f"{payday['spending_in_first_7_days_pct']}% spent near payday",
                "description": "Concentration in first 3 days after deposit",
                "dollar_impact": 0,  # Informational, no direct savings
                "confidence": "HIGH",
                "tool_source": "temporal_patterns",
            })

    # Sort by dollar impact
    insights.sort(key=lambda x: x['dollar_impact'], reverse=True)
    return insights[:10]  # Top 10
```

---

## (10) Real-Time Progress (Server-Sent Events)

**Endpoint: `/api/analyze-stream` (app.py:369-447)**

Streams progress in real-time to the frontend:

```python
@app.route("/api/analyze-stream", methods=["GET"])
def analyze_stream():
    """SSE endpoint — streams real-time progress."""
    session_id = request.args.get("session_id")

    def generate():
        q = queue.Queue()

        def on_progress(event):
            q.put(event)  # Emit progress to stream

        # Run analysis in background thread
        def run_analysis():
            try:
                _auto_categorize_with_llm(df, progress_callback=q.put)
                q.put({"step": "Profiling data..."})

                results = run_agent(df, on_progress=on_progress)
                # Emits: {"step": "Running tool: temporal_patterns..."}
                # Emits: {"step": "Running tool: subscription_hunter..."}

                q.put({"step": "Generating insights..."})
                results["insights"] = synthesize_insights(...)

                result_holder[0] = results
            finally:
                q.put(None)  # Sentinel

        thread = threading.Thread(target=run_analysis)
        thread.start()

        # Stream events to client
        while True:
            event = q.get()
            if event is None:
                break
            yield f"data: {json.dumps(event)}\n\n"  # SSE format

        # Final event with full results
        yield f"data: {json.dumps({'done': True, 'data': result_holder[0]})}\n\n"

    return Response(generate(), mimetype="text/event-stream")
```

**Frontend (Dashboard.jsx:80-136) receives events:**

```javascript
const es = new EventSource(`/api/analyze-stream?session_id=${sessionId}`);

es.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.done) {
    setAnalysisData(data.data);  // Full results → render dashboard
    return;
  }

  if (data.step) {
    setSteps(prev => [...prev, data.step]);  // Add progress line
    // Shows: "Profiling data..." → "Running tool: subscription_hunter..." → "Generating insights..."
  }
};
```

**Example Stream Output:**

```
data: {"step": "Categorizing merchants..."}

data: {"step": "Profiling data..."}

data: {"step": "Running tool: anomaly_detection..."}

data: {"step": "Running tool: subscription_hunter..."}

data: {"step": "Generating insights..."}

data: {"done": true, "data": {"profile": {...}, "results": {...}, "insights": [...]}}
```

---

## (11) Complete Analysis Response

**Final Response Structure (sent to dashboard):**

```json
{
  "profile": {
    "transaction_count": 3,
    "start_date": "2024-03-02",
    "end_date": "2024-03-03",
    "days_span": 1,
    "categories": 2,
    "monthly_totals": [105.43],
    "has_income": false
  },
  "results": {
    "anomaly_detection": {
      "outliers": [],
      "spending_spikes": [],
      "new_merchants": []
    },
    "subscription_hunter": null,
    "temporal_patterns": null,
    "correlation_engine": null,
    "spending_impact": null,
    "financial_resilience": null
  },
  "insights": [
    {
      "title": "All transactions auto-categorized",
      "description": "100% coverage from rules + merchant cache lookup",
      "dollar_impact": 0,
      "confidence": "HIGH",
      "tool_source": "ingestion"
    }
  ],
  "savings_plan": {
    "total_annual_savings": 0,
    "opportunities": []
  }
}
```

---

## Summary: Upload → Categorization → Analysis Flow

```
User clicks "Upload CSV"
    ↓
UploadModal.jsx calls /api/upload
    ↓
[Phase 1: Ingestion]
  • detect_csv_format() → Wealthsimple
  • normalize_to_standard() → {date, amount, merchant}
  • clean_merchant_name() → remove prefixes/locations
  • deduplicate_transactions() → remove exact duplicates
    ↓
[Phase 1.5: Categorization]
  • batch_categorize() → 95% confidence (rules)
  • lookup_merchant() → cache hits
  • Split: categorized (confidence >= 0.7) vs needs_llm
    ↓
/upload returns {session_id, summary}
    ↓
UploadModal shows: "100% auto-categorized · 0 need categorization"
    ↓
User clicks "Analyze My Spending"
    ↓
Dashboard.jsx opens EventSource to /api/analyze-stream
    ↓
[Phase 2: Analysis]
  • _auto_categorize_with_llm() → categorize remaining 30%
  • orchestrator.profile_data() → extract metrics
  • orchestrator.plan_analysis() → decide which tools to run
  • execute_analysis_plan() → run enabled tools (parallel)
  • synthesizer.synthesize_insights() → rank by dollar impact
    ↓
SSE streams progress: "Profiling..." → "Running temporal_patterns..." → "Generating insights..."
    ↓
Final event: {"done": true, "data": {full results}}
    ↓
Dashboard renders:
  • MetricsRow (total, top category, savings potential)
  • SpendingBars (category breakdown)
  • InsightCards (ranked findings)
  • TrendChart, PatternCards, Subscriptions, etc.
```