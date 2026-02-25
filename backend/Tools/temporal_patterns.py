"""
Detect payday spikes, weekly cycles, and seasonal patterns

  detect_payday_pattern(df)
  -> {"payday_detected": True, "payday_day_of_month": 15, "spending_in_first_N_days_pct": 40, ...}

  detect_weekly_pattern(df)
  -> {"weekend_spending_multiple": 1.6, "highest_spending_day": "Saturday", ...}
"""

import pandas as pd
import numpy as np



####################################
# STEP 1: DETECT PAYDAY PATTERN
####################################

def detect_payday_pattern(df: pd.DataFrame) -> dict:

    dates   = pd.to_datetime(df["date"])
    amounts = df["amount"].astype(float)


    # find income deposits — only reliable with category data
    if "category" in df.columns:
        income_mask = df["category"].fillna("").str.lower() == "income"
    else:
        return {"payday_detected": False, "reason": "No category data — cannot identify income deposits"}

    income_dates = dates[income_mask].sort_values()

    if len(income_dates) < 3:
        return {"payday_detected": False, "reason": f"Only {len(income_dates)} income deposits found — need 3+"}


    # spending = everything that's NOT income/transfer
    if "category" in df.columns:
        spend_mask = ~df["category"].fillna("").str.lower().isin(["income", "transfer"])
    else:
        spend_mask = ~income_mask

    spend_df = pd.DataFrame({"date": dates[spend_mask], "amount": amounts[spend_mask]})


    # for each payday, how much was spent in first 7 days vs rest of month?
    first_week_pcts = []

    for pay_date in income_dates:

        month_start = pay_date
        month_end   = pay_date + pd.Timedelta(days=30)
        first_week  = pay_date + pd.Timedelta(days=7)

        month_spend = spend_df[(spend_df["date"] >= month_start) & (spend_df["date"] < month_end)]
        week_spend  = spend_df[(spend_df["date"] >= month_start) & (spend_df["date"] < first_week)]

        if month_spend["amount"].sum() > 0:
            pct = week_spend["amount"].sum() / month_spend["amount"].sum()
            first_week_pcts.append(pct)

    if len(first_week_pcts) < 3:
        return {"payday_detected": False, "reason": "Not enough payday cycles to analyze"}


    avg_pct     = np.mean(first_week_pcts)
    consistency = sum(1 for p in first_week_pcts if p > 0.30) / len(first_week_pcts)

    # payday day of month — most common
    payday_days = income_dates.dt.day.tolist()
    payday_day  = max(set(payday_days), key=payday_days.count)

    if consistency < 0.6:
        return {"payday_detected": False, "reason": f"Pattern too weak (consistency={consistency:.0%})"}

    return {
        "payday_detected":              True,
        "payday_day_of_month":          payday_day,
        "spending_in_first_7_days_pct": round(avg_pct * 100, 1),
        "pattern_consistency":          round(consistency, 2),
        "cycles_analyzed":              len(first_week_pcts),
        "confidence":                   round(min(consistency, 0.95), 2),
    }



####################################
# STEP 2: DETECT WEEKLY PATTERN
####################################

def detect_weekly_pattern(df: pd.DataFrame) -> dict:

    dates   = pd.to_datetime(df["date"])
    amounts = df["amount"].astype(float)

    # filter to spending only
    if "category" in df.columns:
        mask    = ~df["category"].fillna("").str.lower().isin(["income", "transfer"])
        dates   = dates[mask]
        amounts = amounts[mask]

    day_of_week = dates.dt.day_name()

    # average daily spending per day of week
    daily = pd.DataFrame({"day": day_of_week, "amount": amounts})
    avg   = daily.groupby("day")["amount"].mean()

    weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
    weekend  = ["Saturday", "Sunday"]

    weekday_avg = avg.reindex(weekdays).mean()
    weekend_avg = avg.reindex(weekend).mean()

    # how much more on weekends?
    multiple = round(weekend_avg / weekday_avg, 2) if weekday_avg > 0 else 1.0

    # pattern strength: how much variance is explained by day-of-week
    overall_avg = amounts.mean()
    ss_between  = sum(daily.groupby("day")["amount"].count() * (avg - overall_avg) ** 2)
    ss_total    = ((amounts - overall_avg) ** 2).sum()
    strength    = round(float(ss_between / ss_total), 2) if ss_total > 0 else 0.0

    return {
        "weekend_spending_multiple": multiple,
        "highest_spending_day":      avg.idxmax() if not avg.empty else "N/A",
        "lowest_spending_day":       avg.idxmin() if not avg.empty else "N/A",
        "pattern_strength":          strength,
        "weekday_avg":               round(float(weekday_avg), 2),
        "weekend_avg":               round(float(weekend_avg), 2),
    }



####################################
# STEP 3: DETECT SEASONAL PATTERN
####################################

def detect_seasonal_pattern(df: pd.DataFrame) -> dict:

    dates   = pd.to_datetime(df["date"])
    amounts = df["amount"].astype(float)

    span_days = (dates.max() - dates.min()).days

    # group by month
    monthly = pd.DataFrame({"month": dates.dt.to_period("M"), "amount": amounts})
    monthly = monthly.groupby("month")["amount"].sum()

    if len(monthly) < 3:
        return {"seasonal_detected": False, "reason": "Need 3+ months for seasonal analysis"}

    # convert period index to month names for readability
    month_names   = {p: p.strftime("%B %Y") for p in monthly.index}
    seasonal_data = {month_names[p]: round(float(v), 2) for p, v in monthly.items()}

    avg_monthly = monthly.mean()
    peak_month  = monthly.idxmax()
    low_month   = monthly.idxmin()

    # seasonality strength: coefficient of variation
    cv = float(monthly.std() / monthly.mean()) if monthly.mean() > 0 else 0

    # CV < 0.10 = nearly flat spending — not seasonal
    if cv < 0.10:
        return {"seasonal_detected": False, "reason": f"Spending is stable (CV={cv:.2f}), no seasonal pattern"}

    return {
        "seasonal_detected":    True,
        "monthly_totals":       seasonal_data,
        "peak_month":           month_names[peak_month],
        "peak_amount":          round(float(monthly.max()), 2),
        "low_month":            month_names[low_month],
        "low_amount":           round(float(monthly.min()), 2),
        "avg_monthly":          round(float(avg_monthly), 2),
        "seasonality_strength": round(cv, 2),
        "months_analyzed":      len(monthly),
        # weak signal unless we have 2+ years
        "confidence":           "HIGH" if span_days >= 730 else "MEDIUM" if span_days >= 365 else "LOW",
    }
