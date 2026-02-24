"""
Find transaction outliers, category spending spikes, and new merchants

  detect_transaction_outliers(df)
  -> [{"merchant": "Best Buy", "amount": 1247, "z_score": 23.1, ...}]

  detect_spending_spikes(df)
  -> [{"category": "Dining", "recent_month_total": 890, "six_month_avg": 420, "spike_pct": 112}]
"""

import pandas as pd
import numpy as np



####################################
# STEP 1: TRANSACTION OUTLIERS
####################################

def detect_transaction_outliers(df: pd.DataFrame) -> list:
    """
    Flag transactions > 3 sigma from their category mean

    3 sigma = 99.7% confidence — only truly unusual purchases
    """

    results = []

    if "category" not in df.columns:
        return results

    for category, group in df.groupby("category"):

        # skip non-spending categories
        if category and category.lower() in ["income", "transfer"]:
            continue

        cat_amounts = group["amount"].astype(float)

        if len(cat_amounts) < 5:
            continue

        mean = cat_amounts.mean()
        std  = cat_amounts.std()

        if std == 0:
            continue

        # vectorized z-score instead of row-by-row iterrows
        z_scores = (cat_amounts - mean) / std
        outliers = group[z_scores > 3.0]

        for idx, row in outliers.iterrows():
            results.append({
                "merchant":     row.get("merchant", "Unknown"),
                "amount":       round(float(row["amount"]), 2),
                "date":         str(row.get("date", "")),
                "category":     category,
                "category_avg": round(float(mean), 2),
                "category_std": round(float(std), 2),
                "z_score":      round(float(z_scores[idx]), 1),
                "confidence":   "HIGH",
            })

    # sort by z-score descending (most unusual first)
    results.sort(key=lambda x: x["z_score"], reverse=True)

    return results



####################################
# STEP 2: CATEGORY SPENDING SPIKES
####################################

def detect_spending_spikes(df: pd.DataFrame) -> list:
    """
    Compare most recent month vs 6-month average per category

    Spike = recent month > 1.5x the average (50% increase)
    """

    results = []

    if "category" not in df.columns:
        return results

    dates = pd.to_datetime(df["date"])

    # need at least 2 months
    span_days = (dates.max() - dates.min()).days
    if span_days < 45:
        return results


    # most recent complete month
    latest_month = dates.dt.to_period("M").max()

    for category, group in df.groupby("category"):

        if category and category.lower() in ["income", "transfer"]:
            continue

        group_dates = pd.to_datetime(group["date"])
        monthly     = group.groupby(group_dates.dt.to_period("M"))["amount"].sum()

        if len(monthly) < 2:
            continue

        recent = float(monthly.iloc[-1])

        # average of everything except the most recent month
        prior_avg = float(monthly.iloc[:-1].mean())

        if prior_avg == 0:
            continue

        spike_pct = ((recent - prior_avg) / prior_avg) * 100

        if spike_pct > 50:
            results.append({
                "category":           category,
                "recent_month":       str(latest_month),
                "recent_month_total": round(recent, 2),
                "prior_avg":          round(prior_avg, 2),
                "spike_pct":          round(spike_pct, 1),
                "months_compared":    len(monthly) - 1,
            })

    results.sort(key=lambda x: x["spike_pct"], reverse=True)

    return results



####################################
# STEP 3: NEW MERCHANTS
####################################

def detect_new_merchants(df: pd.DataFrame, lookback_days: int = 30) -> list:
    """
    Merchants appearing for the first time recently

    Filters out:
      - transactions < $5 (noise)
      - one-time appearances (no pattern to flag)
    """

    results = []
    dates   = pd.to_datetime(df["date"])
    cutoff  = dates.max() - pd.Timedelta(days=lookback_days)

    # first appearance date per merchant
    first_seen = df.groupby("merchant").agg(
        first_date  = ("date", "min"),
        count       = ("date", "count"),
        avg_amount  = ("amount", "mean"),
    )

    first_seen["first_date"] = pd.to_datetime(first_seen["first_date"])

    # new = first appeared after cutoff, appeared more than once, avg > $5
    new_merchants = first_seen[
        (first_seen["first_date"] >= cutoff) &
        (first_seen["count"] >= 2) &
        (first_seen["avg_amount"] >= 5)
    ]

    for merchant, row in new_merchants.iterrows():

        # check if it looks recurring (monthly-ish interval)
        merchant_dates = pd.to_datetime(df[df["merchant"] == merchant]["date"]).sort_values()
        recurrence     = "one-time"

        if len(merchant_dates) >= 2:
            gaps = merchant_dates.diff().dt.days.dropna()
            avg_gap = gaps.mean()

            if 25 <= avg_gap <= 35:
                recurrence = "monthly"
            elif 6 <= avg_gap <= 8:
                recurrence = "weekly"

        # get category if available
        cat = df[df["merchant"] == merchant]["category"].iloc[0] if "category" in df.columns else "Unknown"

        results.append({
            "merchant":   merchant,
            "category":   cat,
            "first_seen": str(row["first_date"].date()) if hasattr(row["first_date"], "date") else str(row["first_date"]),
            "occurrences": int(row["count"]),
            "avg_amount":  round(float(row["avg_amount"]), 2),
            "recurrence":  recurrence,
        })

    return results
