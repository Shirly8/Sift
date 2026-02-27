"""
Decision-making agent. Inspects data, plans which tools to run, executes, validates.

This is what makes Sift agentic — it adapts to your data instead of running a fixed pipeline.

  profile = profile_data(df)
  plan    = plan_analysis(profile)
  results = execute_analysis_plan(df, plan)

  -> {"tools_run": ["anomaly_detection", ...], "tools_skipped": [("correlation_engine", "need 3+ months")], ...}
"""

import time
import pandas as pd
from concurrent.futures import ThreadPoolExecutor, as_completed

from Tools.temporal_patterns      import detect_payday_pattern, detect_weekly_pattern, detect_seasonal_pattern
from Tools.anomaly_detector       import detect_transaction_outliers, detect_spending_spikes, detect_new_merchants
from Tools.subscription_hunter    import detect_recurring_charges, detect_price_creep, detect_subscription_overlap
from Tools.behavioral_correlation import calculate_category_correlations
from Tools.spending_impact        import fit_impact_model
from Tools.simulator             import stress_test as run_stress_test, calculate_runway


# tool requirements — hard constraints
TOOL_REQUIREMENTS = {
    "temporal_patterns":      {"min_days": 90,  "min_categories": 0},
    "anomaly_detection":      {"min_days": 0,   "min_categories": 0},
    "subscription_hunter":    {"min_transactions": 100, "min_days": 0, "min_categories": 0},
    "correlation_engine":     {"min_days": 90,  "min_categories": 3},
    "spending_impact":        {"min_days": 180, "min_categories": 5},
    "financial_resilience":   {"min_days": 90,  "min_categories": 3},
}



####################################
# STEP 1: PROFILE DATA
####################################

def _compute_spending_metrics(df: pd.DataFrame) -> dict:
    """Compute aggregate spending metrics from transactions."""

    # only count expenses (exclude income & transfers)
    df_spend = df.copy()
    if "amount" in df_spend.columns:
        df_spend["amount"] = df_spend["amount"].abs()

    df_spend["date"] = pd.to_datetime(df_spend["date"])
    df_spend["month"] = df_spend["date"].dt.to_period("M")

    # Filter out income and transfers so totals reflect actual spending
    if "category" in df_spend.columns:
        df_spend = df_spend[~df_spend["category"].fillna("").str.lower().isin(["income", "transfer", ""])]

    total_spent = float(df_spend["amount"].sum())

    # monthly breakdown
    monthly = df_spend.groupby("month")["amount"].sum()

    monthly_totals = monthly.tolist()
    months_count = len(monthly)
    monthly_avg = float(monthly.mean()) if months_count > 0 else 0

    # highest/lowest months
    if len(monthly) > 0:
        highest_idx = monthly.idxmax()
        highest_amount = float(monthly.max())
        highest_month = highest_idx.strftime("%b")
    else:
        highest_amount = 0
        highest_month = "N/A"

    if len(monthly) > 0:
        lowest_idx = monthly.idxmin()
        lowest_amount = float(monthly.min())
        lowest_month = lowest_idx.strftime("%b")
    else:
        lowest_amount = 0
        lowest_month = "N/A"

    # recent 3-month average
    recent_3mo = monthly.tail(3).mean() if len(monthly) >= 3 else monthly_avg

    # category with highest month-to-month dollar range (ignoring income/transfer)
    if "category" in df_spend.columns and months_count >= 3:
        expense_only = df_spend[~df_spend["category"].fillna("").str.lower().isin(["income", "transfer", ""])]
        cat_monthly = expense_only.groupby(["month", "category"])["amount"].sum().unstack(fill_value=0)
        if len(cat_monthly.columns) > 0:
            cat_range = cat_monthly.max() - cat_monthly.min()
            top_cat   = cat_range.idxmax()
            biggest_swing_category = {
                "name": top_cat,
                "min":  float(cat_monthly[top_cat].min()),
                "max":  float(cat_monthly[top_cat].max()),
            }
        else:
            biggest_swing_category = {"name": "N/A", "min": 0, "max": 0}
    else:
        biggest_swing_category = {"name": "N/A", "min": 0, "max": 0}

    # determine trend
    if len(monthly) >= 2:
        recent = monthly.tail(3).mean()
        earlier = monthly.head(3).mean()
        if recent > earlier * 1.1:
            spending_trend = "Gradually rising"
        elif recent < earlier * 0.9:
            spending_trend = "Gradually declining"
        else:
            spending_trend = "Stable"
    else:
        spending_trend = "Insufficient data"

    # income + savings rate (use original df for income since df_spend excludes it)
    monthly_income   = 0
    monthly_spending = float(monthly.mean()) if months_count > 0 else 0
    savings_rate     = 0

    if "category" in df.columns:
        df_all = df.copy()
        df_all["amount"] = df_all["amount"].abs()
        df_all["date"] = pd.to_datetime(df_all["date"])
        df_all["month"] = df_all["date"].dt.to_period("M")
        income_mask = df_all["category"].fillna("").str.lower() == "income"
        income_monthly = df_all[income_mask].groupby("month")["amount"].sum()

        if len(income_monthly) > 0:
            monthly_income = float(income_monthly.mean())
        if monthly_income > 0:
            savings_rate = round(((monthly_income - monthly_spending) / monthly_income) * 100, 1)

    return {
        "total_spent": total_spent,
        "monthly_totals": monthly_totals,
        "months_count": months_count,
        "monthly_average": monthly_avg,
        "highest_month": {"amount": int(highest_amount), "month": highest_month},
        "lowest_month": {"amount": int(lowest_amount), "month": lowest_month},
        "recent_3mo_avg": float(recent_3mo) if len(monthly) >= 3 else monthly_avg,
        "spending_trend": spending_trend,
        "biggest_swing_category": biggest_swing_category,
        "monthly_income": round(monthly_income, 2),
        "monthly_spending": round(monthly_spending, 2),
        "savings_rate": savings_rate,
    }


def profile_data(df: pd.DataFrame) -> dict:

    if df.empty:
        return {
            "transaction_count": 0, "date_range_days": 0,
            "category_count": 0, "categories": [], "has_income": False,
            "start_date": "N/A", "end_date": "N/A",
            "total_spent": 0, "monthly_totals": [], "months_count": 0,
            "monthly_average": 0, "highest_month": {"amount": 0, "month": "N/A"},
            "lowest_month": {"amount": 0, "month": "N/A"}, "recent_3mo_avg": 0,
            "spending_trend": "Insufficient data",
            "biggest_swing_category": {"name": "N/A", "min": 0, "max": 0},
            "monthly_income": 0, "monthly_spending": 0, "savings_rate": 0,
        }

    dates     = pd.to_datetime(df["date"])
    span_days = (dates.max() - dates.min()).days

    categories = []
    if "category" in df.columns:
        categories = df["category"].dropna()
        categories = categories[~categories.str.lower().isin(["income", "transfer", ""])].unique().tolist()

    has_income = False
    if "category" in df.columns:
        has_income = df["category"].fillna("").str.lower().eq("income").any()

    profile = {
        "transaction_count": len(df),
        "date_range_days":   span_days,
        "category_count":    len(categories),
        "categories":        categories,
        "has_income":        has_income,
        "start_date":        str(dates.min().date()),
        "end_date":          str(dates.max().date()),
    }

    # add spending metrics
    spending_metrics = _compute_spending_metrics(df)
    profile.update(spending_metrics)

    print(f"Data profile: {profile['transaction_count']} transactions, "
          f"{span_days} days, {len(categories)} categories, income={'yes' if has_income else 'no'}")

    return profile



####################################
# STEP 2: PLAN ANALYSIS
####################################

def plan_analysis(profile: dict) -> dict:

    tools = []

    for tool_name, reqs in TOOL_REQUIREMENTS.items():

        enabled = True
        reason  = ""

        # hard guardrails — LLM cannot override these
        min_days = reqs.get("min_days", 0)
        if profile["date_range_days"] < min_days:
            enabled = False
            reason  = f"Need {min_days}+ days, have {profile['date_range_days']}"

        min_cats = reqs.get("min_categories", 0)
        if profile["category_count"] < min_cats:
            enabled = False
            reason  = f"Need {min_cats}+ categories, have {profile['category_count']}"

        min_txns = reqs.get("min_transactions", 0)
        if profile["transaction_count"] < min_txns:
            enabled = False
            reason  = f"Need {min_txns}+ transactions, have {profile['transaction_count']}"

        if enabled:
            reason = "requirements met"

        tools.append({
            "name":    tool_name,
            "enabled": enabled,
            "reason":  reason,
        })

    # deterministic priority — tools run in parallel so order only affects display
    PRIORITY = {
        "anomaly_detection": 1, "subscription_hunter": 2,
        "temporal_patterns": 3, "spending_impact": 4, "correlation_engine": 5,
        "financial_resilience": 6,
    }
    for t in tools:
        if t["enabled"]:
            t["priority"] = PRIORITY.get(t["name"], 99)
    tools.sort(key=lambda t: (not t["enabled"], t.get("priority", 99)))

    enabled_count = sum(1 for t in tools if t["enabled"])
    skipped_count = sum(1 for t in tools if not t["enabled"])

    print(f"\nAgent plan: {enabled_count} tools enabled, {skipped_count} skipped")
    for t in tools:
        status = "✅" if t["enabled"] else "❌"
        print(f"  {status} [{t.get('priority', '-')}] {t['name']:25} — {t['reason']}")

    return {"tools": tools}



####################################
# STEP 3: EXECUTE PLAN
####################################

def _run_tool(name: str, df: pd.DataFrame) -> tuple:
    """Execute a single analysis tool. Returns (name, result)."""

    if name == "temporal_patterns":
        return name, {
            "payday":   detect_payday_pattern(df),
            "weekly":   detect_weekly_pattern(df),
            "seasonal": detect_seasonal_pattern(df),
        }

    elif name == "anomaly_detection":
        return name, {
            "outliers":        detect_transaction_outliers(df),
            "spending_spikes": detect_spending_spikes(df),
            "new_merchants":   detect_new_merchants(df),
        }

    elif name == "subscription_hunter":
        recurring = detect_recurring_charges(df)
        return name, {
            "recurring":   recurring,
            "price_creep": [detect_price_creep(df, r["merchant"]) for r in recurring],
            "overlaps":    detect_subscription_overlap(recurring),
        }

    elif name == "correlation_engine":
        return name, calculate_category_correlations(df)

    elif name == "spending_impact":
        return name, fit_impact_model(df)

    elif name == "financial_resilience":
        return name, {
            "stress_test": run_stress_test(df, "job_loss"),
            "runway":      calculate_runway(df),
        }

    return name, {}


def execute_analysis_plan(df: pd.DataFrame, plan: dict, on_progress=None) -> dict:

    def emit(step):
        if on_progress:
            on_progress({"step": step})

    # drop uncategorized rows — NaN categories would skew every tool
    df = df[df["category"].notna() & (df["category"] != "")].copy()

    results       = {}
    tools_run     = []
    tools_skipped = []
    start_time    = time.time()

    # separate enabled vs skipped
    enabled_tools = []
    for tool in plan["tools"]:
        name = tool["name"]
        if not tool["enabled"]:
            tools_skipped.append({"name": name, "reason": tool["reason"]})
        else:
            enabled_tools.append(name)

    emit("Running analysis tools...")

    # run all enabled tools in parallel — they're independent (read-only on df)
    # cap at 4 to avoid thread starvation under gunicorn (1 worker, 4 threads)
    with ThreadPoolExecutor(max_workers=min(len(enabled_tools) or 1, 4)) as executor:
        futures = {}
        for name in enabled_tools:
            label = TOOL_DISPLAY_NAMES.get(name, name)
            emit(label + "...")
            print(f"\nRunning: {name}...")
            futures[executor.submit(_run_tool, name, df)] = name

        for future in as_completed(futures):
            name = futures[future]
            try:
                _, result = future.result()
                results[name] = result
                tools_run.append(name)
                print(f"  Done: {name}")
            except Exception as e:
                print(f"  Error in {name}: {e}")
                results[name] = {"error": str(e)}
                tools_run.append(name)


    elapsed = round(time.time() - start_time, 2)

    print(f"\nAnalysis complete: {len(tools_run)} tools run, {len(tools_skipped)} skipped ({elapsed}s)")

    return {
        "tools_run":     tools_run,
        "tools_skipped": tools_skipped,
        "results":       results,
        "execution_time": elapsed,
    }



####################################
# STEP 4: RUN FULL PIPELINE
####################################

TOOL_DISPLAY_NAMES = {
    "temporal_patterns":    "Analyzing timing patterns",
    "anomaly_detection":    "Detecting unusual spending",
    "subscription_hunter":  "Finding subscriptions",
    "correlation_engine":   "Finding spending links",
    "spending_impact":      "Analyzing spending drivers",
    "financial_resilience": "Assessing financial resilience",
}


def run(df: pd.DataFrame, on_progress=None) -> dict:
    """
    Single entry point: profile -> plan -> execute

    Returns all results + metadata about what ran and what was skipped.
    Optional on_progress callback receives {"step": "human-readable message"} dicts.
    """

    def emit(step):
        if on_progress:
            on_progress({"step": step})

    emit("Profiling your data...")
    profile = profile_data(df)

    emit("Planning analysis...")
    plan = plan_analysis(profile)

    results = execute_analysis_plan(df, plan, on_progress=on_progress)

    results["profile"] = profile
    results["plan"]    = plan

    return results
