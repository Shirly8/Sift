"""
Find cross-category spending relationships using Pearson correlation

Bonferroni correction prevents false positives from multiple comparisons.
With 14 categories = 91 pairs, some will correlate by pure chance.

  calculate_category_correlations(df)
  -> [{"category_a": "Groceries", "category_b": "Delivery", "correlation": -0.72, ...}]
"""

import pandas as pd
import numpy as np
from scipy import stats



####################################
# STEP 1: CATEGORY CORRELATIONS
####################################

def calculate_category_correlations(df: pd.DataFrame) -> list:
    """
    Monthly totals per category -> Pearson correlation matrix -> Bonferroni corrected

    Only report: |r| > 0.5 AND p < 0.05 / (# pairs)
    """

    dates = pd.to_datetime(df["date"])

    # need 3+ months
    span_days = (dates.max() - dates.min()).days
    if span_days < 90:
        return []

    # skip non-spending
    spend_df = df[~df["category"].str.lower().isin(["income", "transfer", ""])].copy()
    spend_df["month"] = pd.to_datetime(spend_df["date"]).dt.to_period("M")


    # monthly totals per category
    pivot = spend_df.pivot_table(
        index   = "month",
        columns = "category",
        values  = "amount",
        aggfunc = "sum",
        fill_value = 0,
    )

    # need at least 3 categories with data
    categories = [c for c in pivot.columns if pivot[c].sum() > 0]
    if len(categories) < 3:
        return []

    n_months = len(pivot)


    # compute all pairwise correlations
    results   = []
    n_pairs   = len(categories) * (len(categories) - 1) // 2
    alpha     = 0.05

    for i in range(len(categories)):
        for j in range(i + 1, len(categories)):

            cat_a = categories[i]
            cat_b = categories[j]

            a = pivot[cat_a].values.astype(float)
            b = pivot[cat_b].values.astype(float)

            # skip if either is constant (no variance)
            if np.std(a) == 0 or np.std(b) == 0:
                continue

            r, p_value = stats.pearsonr(a, b)

            # Bonferroni: only significant if p < alpha / n_pairs
            significant = p_value < (alpha / n_pairs)

            # only report strong + significant
            if abs(r) < 0.5 or not significant:
                continue

            results.append({
                "category_a":     cat_a,
                "category_b":     cat_b,
                "correlation":    round(float(r), 2),
                "p_value":        round(float(p_value), 4),
                "significant":    True,
                "n_months":       n_months,
                "interpretation": interpret_correlation(r, cat_a, cat_b),
                "confidence":     "HIGH" if abs(r) > 0.7 else "MEDIUM",
            })

    # sort by absolute correlation descending
    results.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    print(f"Found {len(results)} significant correlations out of {n_pairs} pairs")

    return results



####################################
# STEP 2: INTERPRET CORRELATION
####################################

def interpret_correlation(corr: float, category_a: str, category_b: str) -> str:

    strength = "strongly" if abs(corr) > 0.7 else "moderately"

    if corr > 0:
        return f"{category_a} and {category_b} {strength} move together (r={corr:.2f})"
    else:
        return f"When {category_a} spending increases, {category_b} drops {strength} (r={corr:.2f})"