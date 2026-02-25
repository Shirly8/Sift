"""
Find cross-category spending relationships using Pearson correlation

Benjamini-Hochberg FDR controls false-discovery rate across multiple
comparisons while remaining practical for typical consumer datasets
(3-6 months, 10-14 categories).

  calculate_category_correlations(df)
  -> [{"category_a": "Groceries", "category_b": "Delivery", "correlation": -0.72, ...}]
"""

import pandas as pd
import numpy as np
from scipy import stats
from statsmodels.stats.multitest import multipletests



####################################
# STEP 1: CATEGORY CORRELATIONS
####################################

def calculate_category_correlations(df: pd.DataFrame) -> list:
    """
    Monthly totals per category -> Pearson correlation matrix -> BH FDR corrected

    Only report: |r| >= 0.4 AND FDR-adjusted p < 0.10
    """

    dates = pd.to_datetime(df["date"])

    # need 3+ months
    span_days = (dates.max() - dates.min()).days
    if span_days < 90:
        return []

    # skip non-spending
    spend_df = df[~df["category"].fillna("").str.lower().isin(["income", "transfer", ""])].copy()
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
    pairs     = []
    n_pairs   = len(categories) * (len(categories) - 1) // 2

    for i in range(len(categories)):
        for j in range(i + 1, len(categories)):

            cat_a = categories[i]
            cat_b = categories[j]

            a = pivot[cat_a].values.astype(float)
            b = pivot[cat_b].values.astype(float)

            # skip if either is constant or near-constant (no meaningful variance)
            if np.std(a, ddof=1) < 1e-10 or np.std(b, ddof=1) < 1e-10:
                continue

            r, p_value = stats.pearsonr(a, b)
            pairs.append((cat_a, cat_b, r, p_value))

    if not pairs:
        print(f"Found 0 significant correlations out of {n_pairs} pairs")
        return []

    # Benjamini-Hochberg FDR correction (less conservative than Bonferroni)
    raw_pvals = [p for _, _, _, p in pairs]
    reject, adjusted_pvals, _, _ = multipletests(raw_pvals, alpha=0.10, method="fdr_bh")

    # filter: |r| >= 0.4 AND FDR-adjusted p < 0.10
    results = []
    for idx, (cat_a, cat_b, r, p_raw) in enumerate(pairs):
        if abs(r) < 0.4 or not reject[idx]:
            continue

        results.append({
            "category_a":     cat_a,
            "category_b":     cat_b,
            "correlation":    round(float(r), 2),
            "p_value":        round(float(adjusted_pvals[idx]), 4),
            "significant":    True,
            "n_months":       n_months,
            "interpretation": interpret_correlation(r, cat_a, cat_b),
            "confidence":     "HIGH" if abs(r) >= 0.7 else "MEDIUM",
        })

    # sort by absolute correlation descending
    results.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    print(f"Found {len(results)} significant correlations out of {n_pairs} pairs (BH FDR, |r|>=0.4)")

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