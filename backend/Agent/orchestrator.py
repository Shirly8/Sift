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

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from Tools.temporal_patterns      import detect_payday_pattern, detect_weekly_pattern, detect_seasonal_pattern
from Tools.anomaly_detector       import detect_transaction_outliers, detect_spending_spikes, detect_new_merchants
from Tools.subscription_hunter    import detect_recurring_charges, detect_price_creep, detect_subscription_overlap
from Tools.behavioral_correlation import calculate_category_correlations
from Tools.spending_impact        import fit_impact_model


# tool requirements — hard constraints
TOOL_REQUIREMENTS = {
    "temporal_patterns":      {"min_days": 90,  "min_categories": 0},
    "anomaly_detection":      {"min_days": 0,   "min_categories": 0},
    "subscription_hunter":    {"min_transactions": 100, "min_days": 0, "min_categories": 0},
    "correlation_engine":     {"min_days": 90,  "min_categories": 3},
    "spending_impact":        {"min_days": 180, "min_categories": 5},
}



####################################
# STEP 1: PROFILE DATA
####################################

def _compute_spending_metrics(df: pd.DataFrame) -> dict:
    """Compute aggregate spending metrics from transactions."""

    # only count expenses (negative amounts or non-income categories)
    df_spend = df.copy()
    if "amount" in df_spend.columns:
        df_spend["amount"] = df_spend["amount"].abs()

    total_spent = float(df_spend["amount"].sum())

    # monthly breakdown
    df_spend["date"] = pd.to_datetime(df_spend["date"])
    df_spend["month"] = df_spend["date"].dt.to_period("M")
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

    # category breakdown for biggest swing
    if "category" in df_spend.columns:
        cat_spend = df_spend.groupby("category")["amount"].agg(['min', 'max', 'mean'])
        cat_spend['swing'] = cat_spend['max'] - cat_spend['min']
        cat_spend = cat_spend.sort_values('swing', ascending=False)

        if len(cat_spend) > 0:
            biggest = cat_spend.iloc[0]
            biggest_swing_category = {
                "name": cat_spend.index[0],
                "min": float(biggest['min']),
                "max": float(biggest['max']),
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
        "annual_savings_potential": 0,  # placeholder for future calculation
    }


def profile_data(df: pd.DataFrame) -> dict:

    dates     = pd.to_datetime(df["date"])
    span_days = (dates.max() - dates.min()).days

    categories = []
    if "category" in df.columns:
        categories = df["category"].dropna()
        categories = categories[~categories.str.lower().isin(["income", "transfer", ""])].unique().tolist()

    has_income = False
    if "category" in df.columns:
        has_income = df["category"].str.lower().eq("income").any()

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

        # check date range
        min_days = reqs.get("min_days", 0)
        if profile["date_range_days"] < min_days:
            enabled = False
            reason  = f"Need {min_days}+ days, have {profile['date_range_days']}"

        # check category count
        min_cats = reqs.get("min_categories", 0)
        if profile["category_count"] < min_cats:
            enabled = False
            reason  = f"Need {min_cats}+ categories, have {profile['category_count']}"

        # check transaction count
        min_txns = reqs.get("min_transactions", 0)
        if profile["transaction_count"] < min_txns:
            enabled = False
            reason  = f"Need {min_txns}+ transactions, have {profile['transaction_count']}"

        # payday detection needs income
        if tool_name == "temporal_patterns" and not profile.get("has_income"):
            # still run — weekly/seasonal don't need income
            pass

        if enabled:
            reason = "requirements met"

        tools.append({
            "name":    tool_name,
            "enabled": enabled,
            "reason":  reason,
        })

    enabled_count = sum(1 for t in tools if t["enabled"])
    skipped_count = sum(1 for t in tools if not t["enabled"])

    print(f"\nAgent plan: {enabled_count} tools enabled, {skipped_count} skipped")
    for t in tools:
        status = "✅" if t["enabled"] else "❌"
        print(f"  {status} {t['name']:25} — {t['reason']}")

    return {"tools": tools}



####################################
# STEP 3: EXECUTE PLAN
####################################

def execute_analysis_plan(df: pd.DataFrame, plan: dict) -> dict:

    # drop uncategorized rows — NaN categories would skew every tool
    df = df[df["category"].notna() & (df["category"] != "")].copy()

    results       = {}
    tools_run     = []
    tools_skipped = []
    start_time    = time.time()


    for tool in plan["tools"]:

        name = tool["name"]

        if not tool["enabled"]:
            tools_skipped.append({"name": name, "reason": tool["reason"]})
            continue

        print(f"\nRunning: {name}...")

        try:
            if name == "temporal_patterns":
                results[name] = {
                    "payday":   detect_payday_pattern(df),
                    "weekly":   detect_weekly_pattern(df),
                    "seasonal": detect_seasonal_pattern(df),
                }

            elif name == "anomaly_detection":
                results[name] = {
                    "outliers":       detect_transaction_outliers(df),
                    "spending_spikes": detect_spending_spikes(df),
                    "new_merchants":  detect_new_merchants(df),
                }

            elif name == "subscription_hunter":
                recurring = detect_recurring_charges(df)
                results[name] = {
                    "recurring":  recurring,
                    "price_creep": [detect_price_creep(df, r["merchant"]) for r in recurring],
                    "overlaps":   detect_subscription_overlap(recurring),
                }

            elif name == "correlation_engine":
                results[name] = calculate_category_correlations(df)

            elif name == "spending_impact":
                results[name] = fit_impact_model(df)

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

def run(df: pd.DataFrame) -> dict:
    """
    Single entry point: profile -> plan -> execute

    Returns all results + metadata about what ran and what was skipped
    """

    profile = profile_data(df)
    plan    = plan_analysis(profile)
    results = execute_analysis_plan(df, plan)

    results["profile"] = profile
    results["plan"]    = plan

    return results
