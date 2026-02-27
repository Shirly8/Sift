"""
Find recurring charges, track price creep, detect subscription overlap

  detect_recurring_charges(df)
  -> [{"merchant": "NETFLIX", "frequency": "monthly", "amount": 22.99, "annual_cost": 275.88}]

  detect_price_creep(df, "NETFLIX")
  -> {"original_price": 15.99, "current_price": 22.99, "total_increase_pct": 43.7}
"""

import pandas as pd



####################################
# STEP 1: DETECT RECURRING CHARGES
####################################

# categories where regular purchases are habits, not subscriptions
HABIT_CATEGORIES = {"dining", "groceries", "delivery", "shopping", "transport"}


def detect_recurring_charges(df: pd.DataFrame) -> list:
    """
    Recurring = same merchant, similar amount, regular interval (25-35 days)

    Requires min 2 cycles to detect, 3+ for HIGH confidence
    """

    results = []

    for merchant, group in df.groupby("merchant"):

        if len(group) < 2:
            continue

        group_dates   = group["date"].sort_values()
        group_amounts = group["amount"].astype(float)

        # check if amounts are consistent (std < 35% of mean)
        # relaxed from 20% to catch tiered/usage-based subscriptions
        # (e.g. phone bills that vary $40-55, cloud services with usage tiers)
        mean_amount = group_amounts.mean()
        if mean_amount < 3:
            continue

        amount_std = group_amounts.std()
        if mean_amount > 0 and (amount_std / mean_amount) > 0.35:
            continue

        # check interval regularity
        gaps     = group_dates.diff().dt.days.dropna()
        avg_gap  = gaps.mean()
        gap_std  = gaps.std() if len(gaps) > 1 else 0

        # monthly: avg gap 25-35 days, low variance
        if 25 <= avg_gap <= 35 and gap_std < 5:
            frequency = "monthly"
        elif 350 <= avg_gap <= 380:
            frequency = "yearly"
        elif 12 <= avg_gap <= 16:
            frequency = "biweekly"
        else:
            continue

        cat = group["category"].iloc[0] if "category" in group.columns else "Subscriptions"

        # filter out habitual purchases masquerading as subscriptions
        # someone buying Starbucks every ~30 days is a habit, not a subscription.
        # true subscriptions have near-identical amounts (CV < 0.10) or are in
        # subscription-like categories (bills, utilities, etc.)
        cat_lower  = cat.lower() if cat else ""
        amount_cv  = (amount_std / mean_amount) if mean_amount > 0 else 0

        if cat_lower in HABIT_CATEGORIES and amount_cv > 0.10:
            # habit purchase: regular timing but inconsistent amounts
            # (e.g. Starbucks $4.50, $5.25, $6.10 — not a subscription)
            continue

        # day of month (most common)
        day_of_month = int(group_dates.dt.day.mode().iloc[0])

        # confidence based on number of cycles and amount consistency
        n_cycles = len(group)

        if n_cycles >= 3 and amount_cv <= 0.05:
            confidence = 0.95     # exact same amount = almost certainly a subscription
        elif n_cycles >= 3 and amount_cv <= 0.10:
            confidence = 0.90
        elif n_cycles >= 3:
            confidence = 0.80     # high-variance recurring (e.g. phone bills)
        else:
            confidence = 0.70

        annual_cost = float(mean_amount) * (12 if frequency == "monthly" else 26 if frequency == "biweekly" else 1)

        results.append({
            "merchant":     merchant,
            "category":     cat,
            "frequency":    frequency,
            "day_of_month": day_of_month,
            "amount":       round(float(mean_amount), 2),
            "annual_cost":  round(annual_cost, 2),
            "confidence":   confidence,
            "active":       True,
            "n_charges":    n_cycles,
        })

    # sort by annual cost descending
    results.sort(key=lambda x: x["annual_cost"], reverse=True)

    total_annual = sum(r["annual_cost"] for r in results)
    total_monthly = sum(r["amount"] for r in results if r["frequency"] == "monthly")

    print(f"Found {len(results)} recurring charges: ${total_monthly:.2f}/month, ${total_annual:.2f}/year")

    return results



####################################
# STEP 2: DETECT PRICE CREEP
####################################

def detect_price_creep(df: pd.DataFrame, merchant: str) -> dict:
    """
    Track price changes for a specific recurring merchant over time

    Only meaningful if merchant has 3+ charges over 3+ months
    """

    merchant_df    = df[df["merchant"].str.upper() == merchant.upper()].copy()
    merchant_df["date"] = pd.to_datetime(merchant_df["date"])
    merchant_df    = merchant_df.sort_values("date")

    if len(merchant_df) < 3:
        return {"merchant": merchant, "price_creep_detected": False, "reason": "Not enough history"}


    # group by month, take the charge amount per month
    merchant_df["month"] = merchant_df["date"].dt.to_period("M")
    monthly = merchant_df.groupby("month")["amount"].mean()

    price_history = [
        {"month": str(p), "amount": round(float(v), 2)}
        for p, v in monthly.items()
    ]

    original = float(monthly.iloc[0])
    current  = float(monthly.iloc[-1])

    if original == 0:
        return {"merchant": merchant, "price_creep_detected": False, "reason": "Original price is 0"}

    increase_pct = ((current - original) / original) * 100

    # only flag if price actually went up
    if increase_pct <= 0:
        return {"merchant": merchant, "price_creep_detected": False, "reason": "No price increase"}

    annual_cost_increase = (current - original) * 12

    return {
        "merchant":             merchant,
        "price_creep_detected": True,
        "price_history":        price_history,
        "original_price":       round(original, 2),
        "current_price":        round(current, 2),
        "total_increase_pct":   round(increase_pct, 1),
        "annual_cost_increase": round(annual_cost_increase, 2),
    }



####################################
# STEP 3: DETECT SUBSCRIPTION OVERLAP
####################################

def detect_subscription_overlap(recurring: list) -> list:
    """
    Multiple subscriptions in the same category = potential overlap

    Group recurring charges by category, flag categories with 2+
    Skip essential categories where multiple subs are normal (utilities, insurance, etc.)
    """

    # categories where having 2+ subscriptions is normal, not overlap
    ESSENTIAL_CATEGORIES = {"Bills & Utilities", "Insurance", "Health", "Transport", "Rent & Housing", "Education"}

    # group by category
    by_category = {}
    for sub in recurring:
        cat = sub.get("category", "Unknown")
        if cat in ESSENTIAL_CATEGORIES:
            continue
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(sub)


    overlaps = []

    for category, subs in by_category.items():
        if len(subs) < 2:
            continue

        combined_annual = sum(s["annual_cost"] for s in subs)

        # rough savings estimate: keep the cheapest, drop the rest
        cheapest         = min(s["annual_cost"] for s in subs)
        potential_savings = round(combined_annual - cheapest, 2)

        overlaps.append({
            "category":          category,
            "subscriptions":     [{"merchant": s["merchant"], "annual": s["annual_cost"]} for s in subs],
            "count":             len(subs),
            "combined_annual":   round(combined_annual, 2),
            "potential_savings": potential_savings,
        })

    overlaps.sort(key=lambda x: x["combined_annual"], reverse=True)

    return overlaps
