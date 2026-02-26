"""
Find transaction outliers, category spending spikes, and new merchants

  detect_transaction_outliers(df)
  -> [{"merchant": "Best Buy", "amount": 1247, "iqr_score": 3.1, "category_median": 45.00, ...}]

  detect_spending_spikes(df)
  -> [{"category": "Dining", "recent_month_total": 890, "prior_avg": 420, "spike_pct": 112}]
"""

import pandas as pd
import numpy as np



####################################
# STEP 1: TRANSACTION OUTLIERS
####################################

def detect_transaction_outliers(df: pd.DataFrame) -> list:
    """
    Flag unusually large transactions using IQR (interquartile range).

    IQR is robust to skewed distributions — transaction amounts are typically
    right-skewed (many small purchases, few large ones), so z-scores on raw
    amounts miss real outliers while flagging legitimate purchases.

    Outlier threshold: amount > Q3 + 2.0 * IQR (stricter than the common 1.5x
    to avoid over-flagging in categories with naturally high variance like Shopping)
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

        q1  = cat_amounts.quantile(0.25)
        q3  = cat_amounts.quantile(0.75)
        iqr = q3 - q1

        if iqr == 0:
            continue

        # 2.0x IQR = stricter threshold — flags truly unusual, not just above-average
        upper_fence = q3 + 2.0 * iqr
        median      = cat_amounts.median()
        outlier_mask = cat_amounts > upper_fence
        outliers     = group[outlier_mask]

        for idx, row in outliers.iterrows():
            amount = float(row["amount"])
            # how many IQRs above Q3 (analogous to z-score but robust)
            iqr_score = round((amount - q3) / iqr, 1)

            results.append({
                "merchant":        row.get("merchant", "Unknown"),
                "amount":          round(amount, 2),
                "date":            str(row.get("date", "")),
                "category":        category,
                "category_median": round(float(median), 2),
                "category_avg":    round(float(cat_amounts.mean()), 2),
                "upper_fence":     round(float(upper_fence), 2),
                "iqr_score":       iqr_score,
                "confidence":      "HIGH" if iqr_score >= 3.0 else "MEDIUM",
            })

    # sort by iqr_score descending (most unusual first)
    results.sort(key=lambda x: x["iqr_score"], reverse=True)

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

    Two detection modes:
      1. Repeated new merchants (count >= 2, avg > $5) — may be a new subscription
      2. High-value one-time charges (count == 1, amount > 3x overall median) — suspicious
    """

    results = []
    dates   = pd.to_datetime(df["date"])
    cutoff  = dates.max() - pd.Timedelta(days=lookback_days)

    # overall median for "high-value" threshold
    overall_median = float(df["amount"].median()) if len(df) > 0 else 50
    high_value_threshold = max(overall_median * 3, 50)  # at least $50

    # first appearance date per merchant
    first_seen = df.groupby("merchant").agg(
        first_date  = ("date", "min"),
        count       = ("date", "count"),
        avg_amount  = ("amount", "mean"),
        max_amount  = ("amount", "max"),
    )

    first_seen["first_date"] = pd.to_datetime(first_seen["first_date"])

    # mode 1: repeated new merchants (potential new subscriptions)
    repeated_new = first_seen[
        (first_seen["first_date"] >= cutoff) &
        (first_seen["count"] >= 2) &
        (first_seen["avg_amount"] >= 5)
    ]

    # mode 2: high-value one-time charges from unknown merchants
    one_time_high = first_seen[
        (first_seen["first_date"] >= cutoff) &
        (first_seen["count"] == 1) &
        (first_seen["max_amount"] >= high_value_threshold)
    ]

    for merchant, row in repeated_new.iterrows():

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

        cat = df[df["merchant"] == merchant]["category"].iloc[0] if "category" in df.columns else "Unknown"

        results.append({
            "merchant":   merchant,
            "category":   cat,
            "first_seen": str(row["first_date"].date()) if hasattr(row["first_date"], "date") else str(row["first_date"]),
            "occurrences": int(row["count"]),
            "avg_amount":  round(float(row["avg_amount"]), 2),
            "recurrence":  recurrence,
        })

    for merchant, row in one_time_high.iterrows():
        cat = df[df["merchant"] == merchant]["category"].iloc[0] if "category" in df.columns else "Unknown"

        results.append({
            "merchant":    merchant,
            "category":    cat,
            "first_seen":  str(row["first_date"].date()) if hasattr(row["first_date"], "date") else str(row["first_date"]),
            "occurrences": 1,
            "avg_amount":  round(float(row["max_amount"]), 2),
            "recurrence":  "one-time",
            "high_value":  True,
        })

    return results
