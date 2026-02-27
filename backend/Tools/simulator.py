"""
Monte Carlo financial projections and stress tests

  run_projection(df, months=12, scenario=None)
  -> {"monthly": [{"month": 1, "spend_p50": 2100, "net_p50": 420, ...}], "baseline": {...}}

  stress_test(df, "job_loss")
  -> {"months_of_runway": 8.3, "runway_ci": {"p10": 6.1, "p90": 11.2}, "categories_to_cut": [...]}

  calculate_runway(df)
  -> {"months_of_runway": 14.2, "monthly_burn": 3800.0, "estimated_savings": 31540.0}

Zero LLM calls. Pure numpy.
"""

import numpy as np
import pandas as pd

from Categorization.constants import ESSENTIAL_CATEGORIES, DISCRETIONARY_CATEGORIES


N_SIMS = 1000



####################################
# STEP 1: BUILD DISTRIBUTIONS
####################################

def _build_distributions(df: pd.DataFrame) -> dict:
    """
    Per-category Normal(mean, std) from monthly spending history.
    Returns {category: {"mean": float, "std": float}}
    """

    spend_df = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])].copy()
    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")

    pivot = spend_df.pivot_table(
        index="month", columns="category", values="amount",
        aggfunc="sum", fill_value=0,
    )

    distributions = {}
    for cat in pivot.columns:
        mean = float(pivot[cat].mean())
        std  = float(pivot[cat].std()) if len(pivot) > 1 else mean * 0.15
        if mean > 0:
            distributions[cat] = {"mean": mean, "std": max(std, 1.0)}

    return distributions



####################################
# STEP 2: MONTE CARLO CORE
####################################

def _simulate(distributions: dict, months: int) -> np.ndarray:
    """
    Sample monthly spending from per-category distributions.
    Returns (N_SIMS, months) array of total monthly spending.
    """

    totals = np.zeros((N_SIMS, months))

    for params in distributions.values():
        samples = np.random.normal(params["mean"], params["std"], (N_SIMS, months))
        totals += np.clip(samples, 0, None)

    return totals



####################################
# STEP 3: RUN PROJECTION
####################################

def run_projection(df: pd.DataFrame, months: int = 12, scenario: dict = None) -> dict:
    """
    Project spending forward with Monte Carlo.

      run_projection(df, months=6)
      -> {"monthly": [{"month": 1, "spend_p50": 2100, "net_p50": 420}], "baseline": {...}}

    scenario: None | {"type": "job_loss"} | {"type": "expense_increase", "category": ..., "multiplier": ...} | {"type": "subscription_purge"}
    """

    distributions = _build_distributions(df)

    if not distributions:
        return {"error": "Not enough spending data"}

    # monthly income average
    income_mask = df["category"].fillna("").str.lower() == "income"
    income_df   = df[income_mask].copy()
    income_df["month"] = pd.to_datetime(income_df["date"]).dt.to_period("M")
    monthly_income = float(income_df.groupby("month")["amount"].sum().mean()) if not income_df.empty else 0.0

    # copy distributions so we can modify without affecting caller
    dists            = {k: dict(v) for k, v in distributions.items()}
    effective_income = monthly_income

    if scenario:
        stype = scenario.get("type")

        if stype == "job_loss":
            effective_income = 0.0

        elif stype == "expense_increase":
            cat  = scenario.get("category", "")
            mult = scenario.get("multiplier", 1.2)
            if cat in dists:
                dists[cat]["mean"] *= mult

        elif stype == "subscription_purge":
            dists = {k: v for k, v in dists.items() if k.lower() != "subscriptions"}

    totals = _simulate(dists, months)  # (N_SIMS, months)
    nets   = effective_income - totals

    monthly = []
    for m in range(months):
        monthly.append({
            "month":     m + 1,
            "spend_p10": round(float(np.percentile(totals[:, m], 10)), 2),
            "spend_p50": round(float(np.percentile(totals[:, m], 50)), 2),
            "spend_p90": round(float(np.percentile(totals[:, m], 90)), 2),
            "net_p50":   round(float(np.percentile(nets[:, m], 50)), 2),
        })

    avg_spend   = float(np.mean(totals))
    fixed_costs = distributions.get("Subscriptions", {}).get("mean", 0.0)

    print(f"Projection: {months}mo, {N_SIMS} sims, scenario={scenario and scenario.get('type')}")

    return {
        "scenario": scenario,
        "months":   months,
        "monthly":  monthly,
        "baseline": {
            "monthly_income":   round(monthly_income, 2),
            "monthly_spending": round(avg_spend, 2),
            "fixed_costs":      round(fixed_costs, 2),
        },
    }



####################################
# STEP 4: STRESS TEST
####################################

def stress_test(df: pd.DataFrame, scenario: str = "job_loss") -> dict:
    """
    Preset stress scenarios.

      stress_test(df, "job_loss")
      -> {"months_of_runway": 8.3, "runway_ci": {"p10": 6.1, "p90": 11.2}, "categories_to_cut": [...]}
    """

    distributions = _build_distributions(df)

    if not distributions:
        return {"error": "Not enough spending data"}


    if scenario == "job_loss":

        # estimated savings = what's been accumulated over the data period
        income_mask = df["category"].fillna("").str.lower() == "income"
        spend_mask  = ~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])

        estimated_savings = max(0.0,
            float(df[income_mask]["amount"].sum()) - float(df[spend_mask]["amount"].sum())
        )

        # MC: how many months until cumulative spending exceeds savings?
        months_sim = 36
        totals     = _simulate(distributions, months_sim)  # (N_SIMS, months)
        cumulative = np.cumsum(totals, axis=1)             # (N_SIMS, months)

        runways = []
        for sim in range(N_SIMS):
            exceeded = np.where(cumulative[sim] > estimated_savings)[0]
            runways.append(int(exceeded[0]) if len(exceeded) else months_sim)

        runways = np.array(runways, dtype=float)

        # discretionary to cut, sorted by monthly spend
        categories_to_cut = sorted(
            [
                {
                    "category": cat,
                    "monthly_avg": round(params["mean"], 2),
                    "potential_savings": round(params["mean"], 2),
                }
                for cat, params in distributions.items()
                if cat.lower() in DISCRETIONARY_CATEGORIES
            ],
            key=lambda x: x["monthly_avg"], reverse=True,
        )[:3]

        min_budget = sum(
            params["mean"] for cat, params in distributions.items()
            if cat.lower() in ESSENTIAL_CATEGORIES
        )

        return {
            "scenario":               "job_loss",
            "months_of_runway":       round(float(np.median(runways)), 1),
            "runway_ci":              {
                "p10": round(float(np.percentile(runways, 10)), 1),
                "p90": round(float(np.percentile(runways, 90)), 1),
            },
            "estimated_savings":      round(estimated_savings, 2),
            "minimum_monthly_budget": round(min_budget, 2),
            "categories_to_cut":      categories_to_cut,
        }


    elif scenario == "subscription_purge":

        sub_monthly    = distributions.get("Subscriptions", {}).get("mean", 0.0)
        annual_savings = sub_monthly * 12

        # compound at 4%/yr with monthly contributions over 5 years
        r      = 0.04 / 12
        fv_5yr = sub_monthly * ((1 + r) ** 60 - 1) / r if r > 0 else annual_savings * 5

        return {
            "scenario":        "subscription_purge",
            "monthly_savings": round(sub_monthly, 2),
            "annual_savings":  round(annual_savings, 2),
            "compounded_5yr":  round(fv_5yr, 2),
        }


    elif scenario == "expense_increase":

        # housing +20% — biggest essential that could realistically spike
        housing = distributions.get("Rent & Housing", {}).get("mean", 0.0)
        impact  = housing * 0.20

        return {
            "scenario":        "expense_increase",
            "category":        "Rent & Housing",
            "current_monthly": round(housing, 2),
            "monthly_impact":  round(impact, 2),
            "annual_impact":   round(impact * 12, 2),
        }


    return {"error": f"Unknown scenario: {scenario}"}



####################################
# STEP 5: CALCULATE RUNWAY
####################################

def calculate_runway(df: pd.DataFrame) -> dict:
    """
    How many months would savings last without income?
    Estimated savings = total income - total spending over data period.

      calculate_runway(df)
      -> {"months_of_runway": 8.3, "monthly_burn": 3800.0, "estimated_savings": 31540.0}
    """

    if "category" not in df.columns:
        return {"months_of_runway": None, "reason": "No category data"}

    income_mask = df["category"].fillna("").str.lower() == "income"
    spend_mask  = ~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])

    if not income_mask.any():
        return {"months_of_runway": None, "reason": "No income detected"}

    total_income      = float(df[income_mask]["amount"].sum())
    total_spending    = float(df[spend_mask]["amount"].sum())
    estimated_savings = max(0.0, total_income - total_spending)

    n_months       = max(1, int(df["date"].dt.to_period("M").nunique()))
    monthly_burn   = total_spending / n_months
    monthly_income = total_income / n_months
    net_monthly    = monthly_income - monthly_burn

    if monthly_burn <= 0:
        return {"months_of_runway": None, "reason": "No spending detected"}

    months_of_runway = estimated_savings / monthly_burn

    return {
        "months_of_runway":  round(months_of_runway, 1),
        "monthly_burn":      round(monthly_burn, 2),
        "monthly_income":    round(monthly_income, 2),
        "net_monthly":       round(net_monthly, 2),
        "estimated_savings": round(estimated_savings, 2),
    }
