"""
Agentic follow-up — user asks a question, agent decides which computations
to run on their actual data, executes them, then explains the results.

  ask("What if I cancel Netflix?", df, analysis_results)
  -> {
       "answer": "Cancelling Netflix saves $275.88/year. It's your 3rd most expensive subscription...",
       "tool_used": "simulate_cancellation",
       "computation": {"savings_annual": 275.88, "remaining_subs": 7, ...}
     }

  ask("Why did dining spike in November?", df, analysis_results)
  -> {
       "answer": "November dining was $890 vs your $420 average. The increase came from...",
       "tool_used": "breakdown_category",
       "computation": {"top_merchants": [...], "new_merchants": [...], ...}
     }
"""

import json
import hashlib
from collections import OrderedDict
import pandas as pd

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from LLM.client       import call_llm, extract_json
from Tools.simulator  import run_projection, stress_test, calculate_runway



####################################
# STEP 1: AVAILABLE TOOLS
####################################

TOOLS_DESCRIPTION = """You have access to these computation tools. Pick the best one for the user's question.

TOOLS:
1. simulate_cancellation — Remove a merchant/subscription and show the savings + ripple effects
   params: {"merchant": "NETFLIX"}

2. breakdown_category — Show merchant-level breakdown for a category, optionally in a specific month
   params: {"category": "Dining", "month": "2025-11"}  (month is optional)

3. compare_periods — Compare spending between two time ranges
   params: {"period_a": "2025-07 to 2025-09", "period_b": "2025-10 to 2025-12", "category": "Dining"}  (category is optional)

4. find_merchant_pattern — Analyze a specific merchant's spending pattern over time
   params: {"merchant": "STARBUCKS"}

5. spending_what_if — Simulate cutting a category by a percentage and show impact
   params: {"category": "Dining", "cut_pct": 30}

6. multi_analyze — For broad questions like "where can I cut back?", "how can I save money?", "what are my options?", "analyze my spending". Breaks down top spending categories by merchant and runs what-if scenarios. Use this when the question doesn't target a specific merchant, category, or time period.
   params: {}

7. simulate_future — Project spending forward with Monte Carlo simulation. For questions like "what will my spending look like?", "can I afford X?", "what happens in 6 months?"
   params: {"months": 12, "scenario": "job_loss"}  (both optional, scenario: job_loss/expense_increase/subscription_purge)

8. stress_test — Financial resilience scenarios. For questions about job loss, emergency fund, runway, "what if I lose my job?", "how long can I survive?", "what if rent goes up?"
   params: {"scenario": "job_loss"}  (job_loss/expense_increase/subscription_purge)

Return JSON only: {"tool": "tool_name", "params": {...}}
If the question is broad or general, use multi_analyze."""



####################################
# STEP 2: ASK (main entry point)
####################################

def ask(question: str, df: pd.DataFrame, analysis_results: dict = None) -> dict:
    """
    User asks a natural language question -> agent picks tool(s) ->
    tools run real computation -> LLM explains the results.

    Simple questions use a single tool. Complex questions chain 2-4 tools
    and synthesize cross-tool findings into one answer.

      ask("What if I cancel Netflix?", df)
      -> {"answer": "...", "tool_used": "simulate_cancellation", "computation": {...}}

      ask("How can I save money?", df)
      -> {"answer": "...", "tool_used": "chain", "tools_chain": [...], "computation": [...]}
    """

    summary = _build_data_summary(df)
    routing = _route_question(question, summary)

    tool_name = routing.get("tool", "general")
    params    = routing.get("params", {})

    print(f"Agent routing: '{question[:50]}...' -> {tool_name}({params})")

    # broad questions: run multi_analyze directly (no LLM chain planning call)
    # multi_analyze already breaks down top categories + runs what-if — the extra
    # LLM planning call added ~500ms latency for the same result
    if tool_name == "multi_analyze":
        computation = _multi_analyze(df, analysis_results)
        answer = _explain_multi_results(question, computation)

        return {
            "answer":      answer,
            "tool_used":   tool_name,
            "computation": computation,
            "confidence":  "HIGH",
            "methodology": "Multi-category breakdown with what-if simulation",
        }

    # simple questions: single tool, fast path
    computation = _execute_tool(tool_name, df, params, analysis_results)
    answer = _explain_results(question, computation, tool_name)

    return {
        "answer":      answer,
        "tool_used":   tool_name,
        "computation": computation,
        "confidence":  _tool_confidence(tool_name, computation),
        "methodology": _tool_methodology(tool_name),
    }



####################################
# STEP 3: ROUTE QUESTION TO TOOL
####################################

def _route_question(question: str, data_summary: str) -> dict:
    """
    Ask Claude which tool to use for this question.
    Returns: {"tool": "tool_name", "params": {...}}
    """

    prompt = f"""A user is asking about their spending data. Pick the right tool.

USER QUESTION: {question}

DATA AVAILABLE:
{data_summary}

{TOOLS_DESCRIPTION}"""

    raw = call_llm(prompt, temperature=0.0, max_tokens=200)

    try:
        return json.loads(extract_json(raw))
    except Exception:
        return {"tool": "general", "params": {}}



####################################
# STEP 4: TOOL IMPLEMENTATIONS
####################################

def _simulate_cancellation(df: pd.DataFrame, merchant: str) -> dict:
    """
    Remove a merchant from the dataset and show what changes.
    Real computation — not LLM guessing.
    """

    merchant_upper = merchant.upper()

    # find matching transactions
    mask    = df["merchant"].str.upper().str.contains(merchant_upper, na=False)
    matched = df[mask]

    if matched.empty:
        return {"found": False, "merchant": merchant, "reason": "Merchant not found in your data"}

    total_spent  = float(matched["amount"].sum())
    n_charges    = len(matched)
    avg_charge   = float(matched["amount"].mean())
    category     = matched["category"].mode().iloc[0] if "category" in matched.columns else "Unknown"

    # check if it's recurring
    dates = pd.to_datetime(matched["date"]).sort_values()
    is_recurring = False
    monthly_cost = 0

    if len(dates) >= 2:
        gaps = dates.diff().dt.days.dropna()
        if 25 <= gaps.mean() <= 35:
            is_recurring = True
            monthly_cost = round(avg_charge, 2)


    # annualized savings
    months_in_data = max(1, (dates.max() - dates.min()).days / 30) if len(dates) >= 2 else 1
    annual_savings = round((total_spent / months_in_data) * 12, 2) if is_recurring else round(total_spent, 2)

    return {
        "found":          True,
        "merchant":       merchant,
        "category":       category,
        "total_spent":    round(total_spent, 2),
        "n_charges":      n_charges,
        "avg_charge":     round(avg_charge, 2),
        "is_recurring":   is_recurring,
        "monthly_cost":   monthly_cost,
        "annual_savings": annual_savings,
    }



def _breakdown_category(df: pd.DataFrame, category: str, month: str = None) -> dict:
    """
    Which merchants are driving spending in a category?
    Optionally filter to a specific month.
    """

    mask = df["category"].fillna("").str.lower() == category.lower()

    if month:
        dates = pd.to_datetime(df["date"])
        month_mask = dates.dt.to_period("M").astype(str) == month
        mask = mask & month_mask

    subset = df[mask]

    if subset.empty:
        return {"found": False, "category": category, "reason": "No transactions found"}


    # top merchants by total
    by_merchant = subset.groupby("merchant").agg(
        total  = ("amount", "sum"),
        count  = ("amount", "count"),
        avg    = ("amount", "mean"),
    ).sort_values("total", ascending=False)

    top_merchants = [
        {"merchant": m, "total": round(float(r["total"]), 2), "count": int(r["count"]), "avg": round(float(r["avg"]), 2)}
        for m, r in by_merchant.head(10).iterrows()
    ]


    # compare to overall average if no month filter
    monthly_avg = None
    if month:
        all_months = df[df["category"].fillna("").str.lower() == category.lower()].copy()
        all_months["month"] = pd.to_datetime(all_months["date"]).dt.to_period("M")
        monthly_totals = all_months.groupby("month")["amount"].sum()
        monthly_avg = round(float(monthly_totals.mean()), 2)


    return {
        "found":          True,
        "category":       category,
        "month":          month,
        "total":          round(float(subset["amount"].sum()), 2),
        "n_transactions": len(subset),
        "top_merchants":  top_merchants,
        "monthly_avg":    monthly_avg,
    }



def _compare_periods(df: pd.DataFrame, period_a: str, period_b: str, category: str = None) -> dict:
    """
    Compare spending between two time ranges.
    Periods: "2025-07 to 2025-09" or just "2025-11"
    """

    dates = pd.to_datetime(df["date"])

    def _parse_period(period_str):
        parts = [p.strip() for p in period_str.split("to")]
        if len(parts) == 2:
            return pd.Period(parts[0], freq="M"), pd.Period(parts[1], freq="M")
        return pd.Period(parts[0], freq="M"), pd.Period(parts[0], freq="M")

    try:
        start_a, end_a = _parse_period(period_a)
        start_b, end_b = _parse_period(period_b)
    except Exception:
        return {"error": f"Couldn't parse periods: '{period_a}' and '{period_b}'"}


    periods = dates.dt.to_period("M")

    mask_a = (periods >= start_a) & (periods <= end_a)
    mask_b = (periods >= start_b) & (periods <= end_b)

    if category:
        cat_mask = df["category"].fillna("").str.lower() == category.lower()
        mask_a = mask_a & cat_mask
        mask_b = mask_b & cat_mask

    total_a = float(df[mask_a]["amount"].sum())
    total_b = float(df[mask_b]["amount"].sum())
    delta   = total_b - total_a
    pct     = round((delta / total_a) * 100, 1) if total_a > 0 else 0


    # per-category breakdown
    breakdown = None
    if not category:
        by_cat_a = df[mask_a].groupby("category")["amount"].sum()
        by_cat_b = df[mask_b].groupby("category")["amount"].sum()

        all_cats  = set(by_cat_a.index) | set(by_cat_b.index)
        breakdown = []

        for cat in all_cats:
            if cat and cat.lower() not in ["income", "transfer"]:
                a = float(by_cat_a.get(cat, 0))
                b = float(by_cat_b.get(cat, 0))
                breakdown.append({"category": cat, "period_a": round(a, 2), "period_b": round(b, 2), "delta": round(b - a, 2)})

        breakdown.sort(key=lambda x: abs(x["delta"]), reverse=True)

    return {
        "period_a":       str(period_a),
        "period_b":       str(period_b),
        "category":       category,
        "total_a":        round(total_a, 2),
        "total_b":        round(total_b, 2),
        "delta":          round(delta, 2),
        "change_pct":     pct,
        "category_breakdown": breakdown,
    }



def _find_merchant_pattern(df: pd.DataFrame, merchant: str) -> dict:
    """
    Everything about one merchant: frequency, amount trend, monthly totals.
    """

    mask    = df["merchant"].str.upper().str.contains(merchant.upper(), na=False)
    matched = df[mask]

    if matched.empty:
        return {"found": False, "merchant": merchant, "reason": "Merchant not found"}


    dates   = pd.to_datetime(matched["date"]).sort_values()
    amounts = matched["amount"].astype(float)

    # monthly totals
    monthly = matched.copy()
    monthly["month"] = dates.dt.to_period("M")
    monthly_totals = monthly.groupby("month")["amount"].sum()

    monthly_data = [
        {"month": str(p), "total": round(float(v), 2)}
        for p, v in monthly_totals.items()
    ]

    # frequency
    frequency = "irregular"
    if len(dates) >= 2:
        gaps = dates.diff().dt.days.dropna()
        avg_gap = gaps.mean()
        if 25 <= avg_gap <= 35:
            frequency = "monthly"
        elif 6 <= avg_gap <= 8:
            frequency = "weekly"
        elif 12 <= avg_gap <= 16:
            frequency = "biweekly"

    # amount trend
    trend = "stable"
    if len(monthly_totals) >= 3:
        first_half = monthly_totals.iloc[:len(monthly_totals)//2].mean()
        second_half = monthly_totals.iloc[len(monthly_totals)//2:].mean()
        if second_half > first_half * 1.15:
            trend = "increasing"
        elif second_half < first_half * 0.85:
            trend = "decreasing"

    return {
        "found":          True,
        "merchant":       merchant,
        "category":       matched["category"].mode().iloc[0] if "category" in matched.columns else "Unknown",
        "total_spent":    round(float(amounts.sum()), 2),
        "n_transactions": len(matched),
        "avg_amount":     round(float(amounts.mean()), 2),
        "frequency":      frequency,
        "trend":          trend,
        "first_seen":     str(dates.min().date()),
        "last_seen":      str(dates.max().date()),
        "monthly_data":   monthly_data,
    }



def _spending_what_if(df: pd.DataFrame, category: str, cut_pct: float) -> dict:
    """
    "What if I cut dining by 30%?" — recalculate with reduced spending.
    """

    mask   = df["category"].fillna("").str.lower() == category.lower()
    subset = df[mask]

    if subset.empty:
        return {"found": False, "category": category, "reason": "Category not found"}


    current_total = float(subset["amount"].sum())

    # use total data span (not just active months) so the monthly average
    # reflects reality — a category with $300 across 3 months out of 12
    # is $25/mo annualized, not $100/mo
    all_dates      = pd.to_datetime(df["date"])
    span_months    = max(1, round((all_dates.max() - all_dates.min()).days / 30.44))
    months_in_data = span_months

    current_monthly = current_total / months_in_data
    reduced_monthly = current_monthly * (1 - cut_pct / 100)
    monthly_savings = current_monthly - reduced_monthly
    annual_savings  = monthly_savings * 12

    # what % of total spending does this category represent?
    total_spending  = float(df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])]["amount"].sum())
    category_pct    = (current_total / total_spending) * 100 if total_spending > 0 else 0

    return {
        "found":            True,
        "category":         category,
        "cut_pct":          cut_pct,
        "current_monthly":  round(current_monthly, 2),
        "reduced_monthly":  round(reduced_monthly, 2),
        "monthly_savings":  round(monthly_savings, 2),
        "annual_savings":   round(annual_savings, 2),
        "category_pct":     round(category_pct, 1),
    }



def _general_summary(df: pd.DataFrame, analysis_results: dict = None) -> dict:
    """
    Fallback: return a data summary for general questions.
    """

    dates = pd.to_datetime(df["date"])
    spend = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])]

    by_category = spend.groupby("category")["amount"].sum().sort_values(ascending=False)
    top_cats    = [{"category": cat, "total": round(float(v), 2)} for cat, v in by_category.head(5).items()]

    return {
        "total_transactions": len(df),
        "total_spending":     round(float(spend["amount"].sum()), 2),
        "date_range":         f"{dates.min().date()} to {dates.max().date()}",
        "top_categories":     top_cats,
        "insights_available": len(analysis_results.get("insights", [])) if analysis_results else 0,
    }



####################################
# STEP 5: TOOL EXECUTOR
####################################

def _execute_tool(tool_name: str, df: pd.DataFrame, params: dict, analysis_results: dict = None) -> dict:
    """Execute a single tool by name. Used by both single-tool and chain paths."""

    if tool_name == "simulate_cancellation":
        return _simulate_cancellation(df, params.get("merchant", ""))

    elif tool_name == "breakdown_category":
        return _breakdown_category(df, params.get("category", ""), params.get("month"))

    elif tool_name == "compare_periods":
        return _compare_periods(df, params.get("period_a", ""), params.get("period_b", ""), params.get("category"))

    elif tool_name == "find_merchant_pattern":
        return _find_merchant_pattern(df, params.get("merchant", ""))

    elif tool_name == "spending_what_if":
        return _spending_what_if(df, params.get("category", ""), params.get("cut_pct", 0))

    elif tool_name == "simulate_future":
        scenario_str = params.get("scenario")
        scenario_dict = None
        if scenario_str == "job_loss":
            scenario_dict = {"type": "job_loss"}
        elif scenario_str == "expense_increase":
            scenario_dict = {"type": "expense_increase", "category": params.get("category", "Rent & Housing"), "multiplier": params.get("multiplier", 1.2)}
        elif scenario_str == "subscription_purge":
            scenario_dict = {"type": "subscription_purge"}
        return run_projection(df, months=params.get("months", 12), scenario=scenario_dict)

    elif tool_name == "stress_test":
        return stress_test(df, params.get("scenario", "job_loss"))

    else:
        return _general_summary(df, analysis_results)



####################################
# STEP 6: MULTI-TOOL ANALYSIS (fallback for when chain planning fails)
####################################

def _multi_analyze(df: pd.DataFrame, analysis_results: dict = None) -> dict:
    """
    Chain multiple tools for broad questions like "where can I cut back?"
    Breaks down top discretionary categories by merchant + runs what-if on each.
    """

    spend  = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])]
    by_cat = spend.groupby("category")["amount"].sum().sort_values(ascending=False)

    discretionary = {"dining", "delivery", "shopping", "entertainment", "personal care"}

    categories = []
    for cat in by_cat.index:
        if cat.lower() not in discretionary:
            continue
        if len(categories) >= 3:
            break

        breakdown = _breakdown_category(df, cat)
        what_if   = _spending_what_if(df, cat, 20)

        categories.append({
            "category":  cat,
            "breakdown": breakdown,
            "what_if":   what_if,
        })

    result = {"categories": categories}

    # include subscription data if available
    if analysis_results:
        subs = analysis_results.get("results", {}).get("subscription_hunter", {})
        if subs.get("overlaps"):
            result["subscription_overlaps"] = subs["overlaps"]
        if subs.get("price_creep"):
            result["price_creep"] = [pc for pc in subs["price_creep"] if pc.get("price_creep_detected")]

    return result



####################################
# STEP 7: EXPLAIN RESULTS (single tool)
####################################

def _explain_results(question: str, computation: dict, tool_name: str) -> str:
    """
    Pass computation results to Claude for natural language explanation.
    The LLM explains — it doesn't compute. The tools already computed.
    """

    prompt = f"""You are a spending intelligence agent. A user asked a question about their finances.
You ran a computation tool and got real results. Explain the results clearly and concisely.

RULES:
- Use the EXACT numbers from the computation — do not make up numbers
- Be direct and concise (3-5 sentences max)
- Use neutral framing. Never say "should", "bad", "problem", "waste", "too much"
- Frame suggestions as options: "One option would be..."
- If the computation found nothing, say so honestly

USER QUESTION: {question}

TOOL USED: {tool_name}

COMPUTATION RESULTS:
{json.dumps(computation, indent=2, default=str)}

Respond in plain text (not JSON). Be conversational but data-driven."""

    response = call_llm(prompt, temperature=0.0, max_tokens=400)

    if not response:
        # fallback: return raw computation as a simple summary
        return f"Here's what I found: {json.dumps(computation, indent=2, default=str)}"

    return response



def _explain_multi_results(question: str, computation: dict) -> str:
    """
    Synthesize multi-tool results into a clear, actionable savings plan.
    Richer output than single-tool explain — names specific merchants and amounts.
    """

    prompt = f"""You are a spending intelligence agent. A user asked a broad question about their finances.
You analyzed their top spending categories, broke each down by merchant, and ran what-if scenarios on their real data.

RULES:
- Use EXACT numbers from the computation — do not make up numbers
- Structure as a prioritized list of 3-5 specific actions
- For each action, name the specific merchants and dollar amounts
- End with the total potential annual savings across all actions
- Use neutral framing — "One option would be..." not "You should..."
- Be specific: "Reduce Uber Eats from $89/mo" not "reduce delivery spending"

USER QUESTION: {question}

MULTI-TOOL COMPUTATION RESULTS:
{json.dumps(computation, indent=2, default=str)}

Respond in plain text. Be direct, specific, and actionable."""

    response = call_llm(prompt, temperature=0.0, max_tokens=600)

    if not response:
        return f"Here's what I found: {json.dumps(computation, indent=2, default=str)}"

    return response



####################################
# STEP 8: DATA SUMMARY FOR ROUTING
####################################

_summary_cache     = OrderedDict()  # keyed by content hash, capped at 20
_SUMMARY_CACHE_MAX = 20

def _build_data_summary(df: pd.DataFrame) -> str:
    """
    Compact summary of available data so the LLM knows what tools can work with.
    Cached per DataFrame content to avoid recomputing on every /api/ask call.
    """

    # content-based hash: len + first/last dates + total amount
    h = hashlib.md5(f"{len(df)}:{df['date'].iloc[0]}:{df['date'].iloc[-1]}:{df['amount'].sum():.2f}".encode()).hexdigest()

    if h in _summary_cache:
        _summary_cache.move_to_end(h)
        return _summary_cache[h]

    dates      = pd.to_datetime(df["date"])
    categories = df["category"].dropna().unique().tolist() if "category" in df.columns else []

    # top 20 merchants by frequency
    top_merchants = df["merchant"].value_counts().head(20).index.tolist() if "merchant" in df.columns else []

    summary = (
        f"Transactions: {len(df)}\n"
        f"Date range: {dates.min().date()} to {dates.max().date()}\n"
        f"Categories: {', '.join(categories)}\n"
        f"Top merchants: {', '.join(top_merchants)}"
    )

    _summary_cache[h] = summary
    if len(_summary_cache) > _SUMMARY_CACHE_MAX:
        _summary_cache.popitem(last=False)

    return summary



####################################
# STEP 9: CONFIDENCE & METHODOLOGY
####################################

def _tool_confidence(tool_name: str, computation: dict) -> str:
    """Assess confidence based on tool type and whether it found real data."""

    if computation.get("found") is False:
        return "LOW"

    # tools backed by direct computation = HIGH confidence
    high_confidence_tools = {
        "simulate_cancellation", "breakdown_category",
        "spending_what_if", "find_merchant_pattern",
        "simulate_future", "stress_test",
    }

    if tool_name in high_confidence_tools:
        return "HIGH"

    if tool_name == "compare_periods":
        return "HIGH" if computation.get("total_a", 0) > 0 else "MEDIUM"

    return "MEDIUM"


def _tool_methodology(tool_name: str) -> str:
    """Human-readable description of how the answer was computed."""

    methods = {
        "simulate_cancellation": "Removed merchant from dataset and recalculated spending impact",
        "breakdown_category":    "Grouped transactions by merchant within category",
        "compare_periods":       "Summed spending per category across two time ranges",
        "find_merchant_pattern": "Analyzed transaction frequency, amounts, and trend over time",
        "spending_what_if":      "Simulated percentage reduction and projected annual savings",
        "multi_analyze":         "Broke down top discretionary categories with what-if scenarios",
        "simulate_future":       "Monte Carlo simulation with 1000 runs using historical spending distributions",
        "stress_test":           "Preset financial stress scenario projected with Monte Carlo simulation",
        "general":               "Summarized overall spending data",
    }

    return methods.get(tool_name, "Computed from transaction data")
