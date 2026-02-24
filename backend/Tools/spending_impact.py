"""
Which categories drive month-to-month spending variance?

Monthly std per category — the higher the std, the more that category
swings your total from month to month.

  fit_impact_model(df)
  -> {"model_valid": True, "impacts": [{"category": "Dining", "impact_pct": 32, "monthly_std": 145.30}, ...]}

Not causal — framed as "variance explanation," not "fault."

NOTE: Previously used linear regression (y = sum of categories), but that's
tautological — R² is always ~1.0 when the target IS the sum of the features.
Replaced with direct std ranking which is what the regression was measuring anyway.
"""

import pandas as pd
import numpy as np



####################################
# STEP 1: FIT IMPACT MODEL
####################################

def fit_impact_model(df: pd.DataFrame) -> dict:

    dates = pd.to_datetime(df["date"])

    # need 6+ months
    span_days = (dates.max() - dates.min()).days
    if span_days < 180:
        return {"model_valid": False, "reason": f"Need 6+ months, have {span_days} days"}


    # skip income/transfer
    spend_df = df[~df["category"].str.lower().isin(["income", "transfer", ""])].copy()
    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")

    # monthly totals per category
    pivot = spend_df.pivot_table(
        index      = "month",
        columns    = "category",
        values     = "amount",
        aggfunc    = "sum",
        fill_value = 0,
    )

    if len(pivot) < 6:
        return {"model_valid": False, "reason": f"Only {len(pivot)} months with data — need 6+"}

    categories = [c for c in pivot.columns if pivot[c].sum() > 0]
    if len(categories) < 3:
        return {"model_valid": False, "reason": "Need 3+ spending categories"}


    # std per category = how much each swings month-to-month
    stds      = pivot[categories].std()
    total_std = stds.sum()

    if total_std == 0:
        return {"model_valid": False, "reason": "No spending variance detected"}

    impacts = []
    for cat in categories:
        pct = (stds[cat] / total_std) * 100

        impacts.append({
            "category":    cat,
            "impact_pct":  round(float(pct), 1),
            "monthly_std": round(float(stds[cat]), 2),
        })

    impacts.sort(key=lambda x: x["impact_pct"], reverse=True)

    confidence = calculate_impact_confidence(len(pivot))

    print(f"Spending drivers: top = {impacts[0]['category']} ({impacts[0]['impact_pct']}%), {len(pivot)} months")

    return {
        "model_valid": True,
        "n_months":    len(pivot),
        "impacts":     impacts,
        "confidence":  confidence,
    }



####################################
# STEP 2: ASSESS CONFIDENCE
####################################

def calculate_impact_confidence(n_months: int) -> str:

    if n_months >= 9:
        return "HIGH"
    elif n_months >= 6:
        return "MEDIUM"
    else:
        return "LOW"