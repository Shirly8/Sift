"""
Monte Carlo spending projections using actual spending patterns

Projects spending forward by sampling from per-category distributions
fitted to historical data. Fixed costs (subscriptions) are deterministic;
variable categories are stochastic (Normal(mean, std)).

  run_projection(df, months=12, n_sims=1000)
  -> {"monthly_net": {10: [...], 50: [...], 90: [...]}, "cumulative_net": {...}, ...}

  stress_test(df, scenario="job_loss")
  -> {"months_of_runway": 8.3, "minimum_monthly_budget": 1200, "categories_to_cut": [...]}

  calculate_runway(df)
  -> {"months_of_runway": 14.2, "confidence_interval": [11.5, 18.1]}

No LLM calls. Pure numpy computation.
"""

import pandas as pd
import numpy as np

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from Tools.subscription_hunter import detect_recurring_charges



####################################
# STEP 1: BUILD DISTRIBUTIONS
####################################

def _build_category_distributions(df: pd.DataFrame, recurring: list) -> tuple:
    """
    Returns (variable_dists, fixed_monthly_total).

    variable_dists: {category: {"mean": float, "std": float}}
    fixed_monthly_total: float (sum of all monthly recurring charges)
    """

    spend_df = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])].copy()
    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")

    pivot = spend_df.pivot_table(
        index="month", columns="category", values="amount",
        aggfunc="sum", fill_value=0,
    )

    # fixed cost total from recurring charges
    fixed_monthly = sum(
        r["amount"] for r in recurring
        if r["frequency"] == "monthly"
    )

    # map recurring merchants -> categories to subtract from variable
    recurring_by_cat = {}
    for r in recurring:
        if r["frequency"] == "monthly":
            cat = r.get("category", "Unknown")
            recurring_by_cat[cat] = recurring_by_cat.get(cat, 0) + r["amount"]

    # build distributions, subtracting fixed costs from their categories
    means = pivot.mean()
    stds  = pivot.std()

    variable_dists = {}
    for cat in pivot.columns:
        if cat.lower() in ["income", "transfer"]:
            continue

        adj_mean = float(means[cat]) - recurring_by_cat.get(cat, 0)
        adj_mean = max(0, adj_mean)

        # if std is 0 or too few months, use 10% of mean as synthetic variance
        cat_std = float(stds[cat]) if len(pivot) >= 3 and stds[cat] > 0 else adj_mean * 0.10

        variable_dists[cat] = {"mean": adj_mean, "std": cat_std}

    return variable_dists, fixed_monthly


def _get_monthly_income(df: pd.DataFrame) -> float:
    """Average monthly income from transaction data."""

    if "category" not in df.columns:
        return 0

    income_df = df[df["category"].fillna("").str.lower() == "income"].copy()
    if income_df.empty:
        return 0

    income_df["month"] = pd.to_datetime(income_df["date"]).dt.to_period("M")
    monthly = income_df.groupby("month")["amount"].sum()

    return float(monthly.mean()) if len(monthly) > 0 else 0



####################################
# STEP 2: RUN PROJECTION
####################################

def run_projection(
    df: pd.DataFrame,
    months: int = 12,
    n_sims: int = 1000,
    scenario: dict = None,
) -> dict:
    """
    Monte Carlo projection of spending over N months.

      run_projection(df, months=12)
      -> {"monthly_net": {10: [...], 50: [...]}, "cumulative_net": {...}, "baseline": {...}}

    scenario format:
      {"type": "job_loss"}
      {"type": "expense_increase", "category": "Rent & Housing", "multiplier": 1.2}
      {"type": "subscription_purge"}
    """

    recurring = detect_recurring_charges(df)
    variable_dists, fixed_monthly = _build_category_distributions(df, recurring)
    income = _get_monthly_income(df)

    if not variable_dists:
        return {"error": "Not enough spending data for projection"}

    cat_names = list(variable_dists.keys())
    n_cats    = len(cat_names)
    cat_means = np.array([variable_dists[c]["mean"] for c in cat_names])
    cat_stds  = np.array([variable_dists[c]["std"]  for c in cat_names])

    # vectorized sampling: (n_sims, months, n_categories)
    samples = np.random.normal(
        loc=cat_means, scale=cat_stds,
        size=(n_sims, months, n_cats),
    )
    samples = np.maximum(samples, 0)

    # apply scenario modifiers
    effective_income  = income
    effective_fixed   = fixed_monthly

    if scenario:
        if scenario.get("type") == "job_loss":
            effective_income = 0

        elif scenario.get("type") == "expense_increase":
            target = scenario.get("category", "")
            mult   = scenario.get("multiplier", 1.2)
            for i, c in enumerate(cat_names):
                if c.lower() == target.lower():
                    samples[:, :, i] *= mult

        elif scenario.get("type") == "subscription_purge":
            essential_cats = {"bills & utilities", "insurance", "rent & housing"}
            purged = sum(
                r["amount"] for r in recurring
                if r["frequency"] == "monthly"
                and r.get("category", "").lower() not in essential_cats
            )
            effective_fixed -= purged

    # monthly spending per sim
    monthly_variable = samples.sum(axis=2)
    monthly_spending = monthly_variable + effective_fixed

    # net = income - spending
    monthly_net = effective_income - monthly_spending
    cumulative  = np.cumsum(monthly_net, axis=1)

    # extract percentiles
    pct_keys      = [10, 25, 50, 75, 90]
    monthly_pct   = {p: np.percentile(monthly_net, p, axis=0).round(2).tolist() for p in pct_keys}
    cumulative_pct = {p: np.percentile(cumulative, p, axis=0).round(2).tolist() for p in pct_keys}

    total_variable = float(cat_means.sum())

    print(f"Projection: {months}mo, {n_sims} sims, {n_cats} categories, scenario={scenario}")

    return {
        "monthly_net":    monthly_pct,
        "cumulative_net": cumulative_pct,
        "baseline": {
            "monthly_income":    round(income, 2),
            "monthly_spending":  round(total_variable + fixed_monthly, 2),
            "fixed_costs":       round(fixed_monthly, 2),
            "variable_spending": round(total_variable, 2),
        },
        "scenario_applied": scenario.get("type") if scenario else None,
        "has_income":        income > 0,
        "n_sims":            n_sims,
        "months":            months,
    }



####################################
# STEP 3: STRESS TEST
####################################

ESSENTIAL_CATEGORIES = {"groceries", "grocery", "rent & housing", "rent", "mortgage",
                        "healthcare", "medical", "insurance", "utilities",
                        "bills & utilities", "childcare", "education"}

def stress_test(df: pd.DataFrame, scenario: str = "job_loss") -> dict:
    """
    Preset stress scenarios with actionable outputs.

      stress_test(df, "job_loss")
      -> {"months_of_runway": 8.3, "minimum_monthly_budget": 1200, "categories_to_cut": [...]}
    """

    valid_scenarios = {"job_loss", "expense_increase", "subscription_purge"}
    if scenario not in valid_scenarios:
        raise ValueError(f"Unknown scenario '{scenario}'. Must be one of: {valid_scenarios}")

    if scenario == "job_loss":
        return _stress_job_loss(df)
    elif scenario == "expense_increase":
        return _stress_expense_increase(df)
    elif scenario == "subscription_purge":
        return _stress_subscription_purge(df)


def _stress_job_loss(df: pd.DataFrame) -> dict:
    """Income drops to 0 — how many months can you survive?"""

    projection = run_projection(df, months=24, n_sims=1000, scenario={"type": "job_loss"})

    if "error" in projection:
        return {"scenario": "job_loss", "error": projection["error"]}

    # find month where median cumulative crosses zero
    median_cum = projection["cumulative_net"][50]
    months_of_runway = 0

    for i, val in enumerate(median_cum):
        if val < 0:
            # interpolate between this month and previous
            if i == 0:
                months_of_runway = 0
            else:
                prev = median_cum[i - 1]
                months_of_runway = i + (prev / (prev - val)) if prev != val else i
            break
    else:
        months_of_runway = len(median_cum)

    # confidence interval from 10th and 90th percentile crossings
    ci_low  = _find_crossover(projection["cumulative_net"][90])
    ci_high = _find_crossover(projection["cumulative_net"][10])

    # minimum monthly budget = median monthly spending (75th pct for conservative)
    monthly_spending = projection["baseline"]["monthly_spending"]

    # categories to cut, ranked by monthly avg, essentials excluded
    spend_df = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])].copy()
    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")

    cat_monthly = spend_df.groupby("category")["amount"].sum() / max(1, spend_df["month"].nunique())

    categories_to_cut = []
    for cat, avg in cat_monthly.sort_values(ascending=False).items():
        if cat.lower() in ESSENTIAL_CATEGORIES:
            continue
        if avg < 20:
            continue
        categories_to_cut.append({
            "category":          cat,
            "monthly_avg":       round(float(avg), 2),
            "potential_savings": round(float(avg) * 0.5, 2),
        })

    return {
        "scenario":              "job_loss",
        "months_of_runway":      round(months_of_runway, 1),
        "confidence_interval":   [round(ci_low, 1), round(ci_high, 1)],
        "minimum_monthly_budget": round(monthly_spending, 2),
        "categories_to_cut":     categories_to_cut[:5],
        "projection":            projection,
    }


def _stress_expense_increase(df: pd.DataFrame) -> dict:
    """Housing costs +20% — impact on monthly savings."""

    baseline   = run_projection(df, months=12, n_sims=1000)
    increased  = run_projection(df, months=12, n_sims=1000,
                                scenario={"type": "expense_increase", "category": "Rent & Housing", "multiplier": 1.2})

    if "error" in baseline or "error" in increased:
        return {"scenario": "expense_increase", "error": "Not enough data"}

    baseline_net  = baseline["cumulative_net"][50][-1] / 12
    increased_net = increased["cumulative_net"][50][-1] / 12
    delta         = increased_net - baseline_net

    return {
        "scenario":            "expense_increase",
        "category":            "Rent & Housing",
        "multiplier":          1.2,
        "baseline_monthly_net":  round(baseline_net, 2),
        "increased_monthly_net": round(increased_net, 2),
        "monthly_impact":        round(delta, 2),
        "annual_impact":         round(delta * 12, 2),
        "projection":            increased,
    }


def _stress_subscription_purge(df: pd.DataFrame) -> dict:
    """Cancel all discretionary subs — show savings compounded over time."""

    recurring = detect_recurring_charges(df)
    essential_cats = {"bills & utilities", "insurance", "rent & housing", "education", "health"}

    discretionary_subs = [
        r for r in recurring
        if r["frequency"] == "monthly"
        and r.get("category", "").lower() not in essential_cats
    ]

    monthly_savings = sum(r["amount"] for r in discretionary_subs)
    annual_savings  = monthly_savings * 12

    # compound at 4% annual rate (conservative investment return)
    compounded = {}
    for years in [1, 3, 5]:
        rate    = 0.04
        monthly = monthly_savings
        total   = 0
        for m in range(years * 12):
            total = (total + monthly) * (1 + rate / 12)
        compounded[f"{years}yr"] = round(total, 2)

    projection = run_projection(df, months=12, n_sims=1000, scenario={"type": "subscription_purge"})

    return {
        "scenario":              "subscription_purge",
        "subscriptions_purged":  [{"merchant": r["merchant"], "amount": r["amount"]} for r in discretionary_subs],
        "monthly_savings":       round(monthly_savings, 2),
        "annual_savings":        round(annual_savings, 2),
        "compounded_savings":    compounded,
        "projection":            projection,
    }



####################################
# STEP 4: CALCULATE RUNWAY
####################################

def calculate_runway(df: pd.DataFrame) -> dict:
    """
    Months until savings depleted at current burn rate.

      calculate_runway(df)  -> {"months_of_runway": 14.2, "confidence_interval": [11.5, 18.1]}
    """

    income   = _get_monthly_income(df)
    spending = _get_monthly_spending(df)

    if income == 0 and spending > 0:
        return {
            "months_of_runway":    0,
            "confidence_interval": [0, 0],
            "monthly_burn_rate":   round(spending, 2),
            "monthly_income":      0,
            "net_monthly":         round(-spending, 2),
        }

    net = income - spending

    if net >= 0:
        return {
            "months_of_runway":    float('inf'),
            "confidence_interval": [float('inf'), float('inf')],
            "monthly_burn_rate":   0,
            "monthly_income":      round(income, 2),
            "net_monthly":         round(net, 2),
        }

    # Monte Carlo: project with income to find when cumulative crosses zero
    projection = run_projection(df, months=36, n_sims=1000)

    if "error" in projection:
        # fallback: simple division
        runway = income / spending * 30 if spending > 0 else 0
        return {
            "months_of_runway":    round(runway, 1),
            "confidence_interval": [round(runway * 0.7, 1), round(runway * 1.3, 1)],
            "monthly_burn_rate":   round(-net, 2),
            "monthly_income":      round(income, 2),
            "net_monthly":         round(net, 2),
        }

    median_runway = _find_crossover(projection["cumulative_net"][50])
    ci_low        = _find_crossover(projection["cumulative_net"][90])
    ci_high       = _find_crossover(projection["cumulative_net"][10])

    return {
        "months_of_runway":    round(median_runway, 1),
        "confidence_interval": [round(ci_low, 1), round(ci_high, 1)],
        "monthly_burn_rate":   round(-net, 2),
        "monthly_income":      round(income, 2),
        "net_monthly":         round(net, 2),
    }


def _get_monthly_spending(df: pd.DataFrame) -> float:
    """Average monthly spending (excluding income/transfers)."""

    spend_df = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])].copy()

    if spend_df.empty:
        return 0

    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")
    monthly = spend_df.groupby("month")["amount"].sum()

    return float(monthly.mean()) if len(monthly) > 0 else 0


def _find_crossover(cumulative: list) -> float:
    """Find the month where cumulative net crosses zero (interpolated)."""

    for i, val in enumerate(cumulative):
        if val < 0:
            if i == 0:
                return 0
            prev = cumulative[i - 1]
            return i + (prev / (prev - val)) if prev != val else float(i)

    return float(len(cumulative))
