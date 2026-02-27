"""
Convert raw tool outputs into ranked, human-readable insights via LLM

Each insight has: title, description, dollar impact, confidence, action option.
All framing is neutral — never moralizing.

  synthesize_insights(tool_results, profile)
  -> [{"title": "8 subscriptions costing $187/month", "dollar_impact": 2250, "confidence": "HIGH", ...}]

Cross-referencing connects insights across tools — things no single tool can see.
E.g. payday spike + dining is top variance driver = post-payday dining is the swing factor.
"""

import json
import pandas as pd

from LLM.client import call_llm, extract_json
from Categorization.constants import ESSENTIAL_CATEGORIES, DISCRETIONARY_CATEGORIES


# words that should NEVER appear in insights — expanded to catch subtle judgment + jargon
BANNED_WORDS = [
    "should", "bad", "problem", "waste", "too much", "excessive",
    "avoid", "excess", "splurge", "cut back", "habit", "frequent",
    "overspend", "reckless", "irresponsible", "guilty", "alarming",
    "variance", "standard deviation", "coefficient", "regression",
    "percentile", "volatility", "burn rate",
]



####################################
# STEP 1: SYNTHESIZE INSIGHTS
####################################

def synthesize_insights(tool_results: dict, profile: dict, llm_call=None) -> list:
    """
    Cross-reference tool outputs into ranked insights.
    LLM synthesis is only used as a fallback when cross-refs produce < 2 insights
    — this avoids a wasted LLM call in the common case where cross-refs already
    cover the data, and reduces hallucination risk from LLM-generated dollar amounts.
    """

    cross_refs = _cross_reference(tool_results)

    # supplement with LLM — tell it what topics are already covered so it generates NEW ones
    if len(cross_refs) < 6:
        existing_topics = set()
        for ins in cross_refs:
            existing_topics.update(_extract_insight_keys(
                f"{ins.get('title', '')} {ins.get('description', '')}".lower()
            ))
        fn = llm_call or call_llm
        llm_insights = _synthesize_with_llm(tool_results, profile, fn, avoid_topics=existing_topics)
        cross_refs.extend(llm_insights)

    insights = _fact_check_dollar_impacts(cross_refs, tool_results)
    insights = _deduplicate_insights(insights)

    return rank_insights_by_impact(insights)[:5]



def _condense_tool_results(tool_results: dict, profile: dict) -> str:
    """
    Extract only the key findings from each tool — compress ~10k tokens of raw JSON
    into ~300-500 tokens of signal. Makes LLM synthesis fast and reliable on any model.
    """
    lines = []

    # profile summary
    avg = profile.get("monthly_average", 0)
    trend = profile.get("spending_trend", "")
    months = profile.get("months_count", 0)
    income = profile.get("monthly_income", 0)
    if avg:
        lines.append(f"Monthly average: ${avg:.0f}/mo over {months} months. Trend: {trend or 'stable'}.")
    if income:
        lines.append(f"Income: ${income:.0f}/mo. Net: ${income - avg:.0f}/mo.")

    # spending impact — top 3 drivers
    impact = tool_results.get("spending_impact", {})
    if impact.get("model_valid") and impact.get("impacts"):
        top3 = impact["impacts"][:3]
        cats = ", ".join(f"{c['category']} ${c['monthly_avg']:.0f}/mo ({c['impact_pct']:.0f}% of variation)" for c in top3)
        lines.append(f"Top spending drivers: {cats}.")

    # temporal patterns
    temporal = tool_results.get("temporal_patterns", {})
    payday = temporal.get("payday", {})
    weekly = temporal.get("weekly", {})
    if payday.get("payday_detected"):
        lines.append(f"Payday detected: {payday['spending_in_first_7_days_pct']:.0f}% spent in first 7 days.")
    if weekly.get("weekend_spending_multiple", 1) > 1.1:
        lines.append(f"Weekend spending: {weekly['weekend_spending_multiple']:.1f}x weekday average. "
                      f"Highest day: {weekly.get('highest_spending_day', '?')}, lowest: {weekly.get('lowest_spending_day', '?')}.")

    # subscriptions
    subs = tool_results.get("subscription_hunter", {})
    recurring = subs.get("recurring", [])
    if recurring:
        total_annual = sum(s.get("annual_cost", 0) for s in recurring)
        lines.append(f"Subscriptions: {len(recurring)} found, ${total_annual:.0f}/year total.")
    overlaps = subs.get("overlaps", [])
    if overlaps:
        overlap_cost = sum(o.get("combined_annual", 0) for o in overlaps)
        lines.append(f"Subscription overlaps: {len(overlaps)} groups, ${overlap_cost:.0f}/year combined.")
    creeping = [pc for pc in subs.get("price_creep", []) if pc.get("price_creep_detected")]
    if creeping:
        creep_total = sum(pc.get("annual_cost_increase", 0) for pc in creeping)
        lines.append(f"Price creep: {len(creeping)} subscriptions increasing, ${creep_total:.0f}/year in increases.")

    # anomalies
    anomalies = tool_results.get("anomaly_detection", {})
    spikes = anomalies.get("spending_spikes", [])
    if spikes:
        spike_strs = ", ".join(f"{s['category']} +{s['spike_pct']:.0f}%" for s in spikes[:3])
        lines.append(f"Recent spending spikes: {spike_strs}.")
    outliers = anomalies.get("outliers", [])
    if outliers:
        lines.append(f"Unusual transactions: {len(outliers)} flagged (largest: ${outliers[0].get('amount', 0):.0f} at {outliers[0].get('merchant', '?')}).")

    # correlations
    correlations = tool_results.get("correlation_engine", [])
    if correlations:
        corr_strs = ", ".join(
            f"{c['category_a']}↔{c['category_b']} ({'move together' if c['correlation'] > 0 else 'opposite'})"
            for c in correlations[:3]
        )
        lines.append(f"Spending connections: {corr_strs}.")

    # financial resilience
    resilience = tool_results.get("financial_resilience", {})
    runway = resilience.get("runway", {})
    if runway.get("months_of_runway"):
        mo = runway["months_of_runway"]
        if mo != float('inf') and mo < 200:
            lines.append(f"Savings runway: {mo:.0f} months at current pace.")
        else:
            lines.append("Savings runway: surplus (earning more than spending).")

    return "\n".join(lines)


def _synthesize_with_llm(tool_results: dict, profile: dict, llm_call, avoid_topics: set = None) -> list:

    summary = _condense_tool_results(tool_results, profile)

    avoid_line = ""
    if avoid_topics:
        avoid_line = f"\n- AVOID these topics (already covered): {', '.join(avoid_topics)}. Find DIFFERENT angles."

    prompt = f"""You are a spending intelligence agent. Generate 3-5 insights from this spending analysis.

RULES:
- Each insight: title, description, dollar_impact (annual, from the data), confidence (HIGH/MEDIUM/LOW), action_option
- Neutral framing. Never say "should", "bad", "problem", "waste", "too much"
- Frame actions as options: "One option would be..." not "You should..."
- Every insight MUST connect 2+ data points or reveal something non-obvious
- Each insight must be distinct — no two about the same category
- NEVER suggest reducing essentials (groceries, rent, healthcare, utilities, insurance)
- Plain language only — no statistical jargon{avoid_line}

ANALYSIS SUMMARY:
{summary}

Return JSON array only: [{{"title": "...", "description": "...", "dollar_impact": 0, "confidence": "HIGH", "action_option": "...", "tool_source": "llm"}}]"""

    try:
        raw = llm_call(prompt, temperature=0.0, max_tokens=800)
        if not raw:
            return []

        parsed = json.loads(extract_json(raw))
        if isinstance(parsed, dict):
            parsed = parsed.get("insights", [])

        insights = [i for i in parsed if validate_insight_framing(i)]

        for i in insights:
            print(f"  LLM insight: {i.get('title', '')} — {i.get('description', '')[:80]}")

        return insights

    except Exception as e:
        print(f"LLM synthesis failed ({e})")
        return []




####################################
# STEP 2: CROSS-REFERENCE INSIGHTS
####################################

def _cross_reference(tool_results: dict) -> list:
    """
    Find connections BETWEEN tool outputs that no single tool can see.

    This is the agentic synthesis — combining payday patterns with spending drivers,
    correlations with subscription overlap, spikes with temporal patterns.
    """

    cross_refs = []

    temporal = tool_results.get("temporal_patterns", {})
    impact   = tool_results.get("spending_impact", {})
    subs     = tool_results.get("subscription_hunter", {})
    anomalies = tool_results.get("anomaly_detection", {})
    correlations = tool_results.get("correlation_engine", [])


    # payday spike + spending driver = post-payday spending in top category
    payday = temporal.get("payday", {})
    if payday.get("payday_detected") and impact.get("model_valid") and impact.get("impacts"):

        top_driver  = impact["impacts"][0]
        payday_pct  = payday["spending_in_first_7_days_pct"]

        cross_refs.append({
            "title":         f"Most of your {top_driver['category']} spending happens right after payday",
            "description":   (
                f"{payday_pct}% of your spending happens in the first week after payday, "
                f"and {top_driver['category']} is the category that changes the most month to month. "
                f"That first week after payday is likely when most of your {top_driver['category']} money goes."
            ),
            "dollar_impact": 0,
            "confidence":    "HIGH",
            "action_option": f"One option would be setting a {top_driver['category']} budget for the first week after payday.",
            "tool_source":   "cross_reference",
        })


    # weekend pattern + spending driver = weekend spending in top category
    weekly = temporal.get("weekly", {})
    if weekly.get("weekend_spending_multiple", 1.0) > 1.3 and impact.get("model_valid") and impact.get("impacts"):

        top_driver = impact["impacts"][0]
        mult       = weekly["weekend_spending_multiple"]

        # only flag if the top driver is a weekend-heavy category (dining, entertainment, transport)
        weekend_cats = ["dining", "entertainment", "transport", "shopping"]
        if top_driver["category"].lower() in weekend_cats:
            cross_refs.append({
                "title":         f"Weekends are when your {top_driver['category']} spending jumps",
                "description":   (
                    f"You spend about {mult}x more on weekends than weekdays, "
                    f"and {top_driver['category']} is the category that changes the most from month to month. "
                    f"Weekend {top_driver['category']} is likely a big part of why your total spending shifts."
                ),
                "dollar_impact": 0,
                "confidence":    "MEDIUM",
                "action_option": None,
                "tool_source":   "cross_reference",
            })


    # correlation + spending spike = the spike might be explained by a related category
    spikes = anomalies.get("spending_spikes", [])
    if spikes and correlations:

        for spike in spikes[:1]:
            spike_cat = spike["category"]

            # did a correlated category also move?
            for corr in correlations:
                related_cat = None
                if corr["category_a"].lower() == spike_cat.lower():
                    related_cat = corr["category_b"]
                elif corr["category_b"].lower() == spike_cat.lower():
                    related_cat = corr["category_a"]

                if related_cat and corr["correlation"] > 0:
                    cross_refs.append({
                        "title":         f"Your {spike_cat} and {related_cat} spending tend to rise together",
                        "description":   (
                            f"{spike_cat} jumped {spike['spike_pct']:.0f}% last month. "
                            f"When {spike_cat} goes up, {related_cat} usually does too — "
                            f"so both categories may be climbing right now."
                        ),
                        "dollar_impact": 0,
                        "confidence":    "MEDIUM",
                        "action_option": None,
                        "tool_source":   "cross_reference",
                    })
                    break


    # subscription overlap + price creep = compounding subscription cost
    if subs.get("overlaps") and subs.get("price_creep"):

        creeping = [pc for pc in subs["price_creep"] if pc.get("price_creep_detected")]

        if creeping and subs["overlaps"]:
            total_creep = sum(pc["annual_cost_increase"] for pc in creeping)
            overlap_cost = sum(o["combined_annual"] for o in subs["overlaps"])

            cross_refs.append({
                "title":         f"Subscription costs are growing from two directions",
                "description":   (
                    f"You have overlapping subscriptions (${overlap_cost:.2f}/year combined) "
                    f"and prices are creeping up (${total_creep:.2f}/year in increases). "
                    f"Together, your subscription spend is expanding both in count and per-unit cost."
                ),
                "dollar_impact": round(total_creep, 2),
                "confidence":    "HIGH",
                "action_option": "One option would be auditing subscriptions for both overlap and price increases at the same time.",
                "tool_source":   "cross_reference",
            })


    # financial resilience + spending drivers = targeted runway insight
    resilience = tool_results.get("financial_resilience", {})
    runway     = resilience.get("runway", {})

    if runway.get("months_of_runway") and runway["months_of_runway"] != float('inf') and impact.get("model_valid"):

        top_driver = impact["impacts"][0]
        months     = runway["months_of_runway"]

        cross_refs.append({
            "title":         f"Your savings could cover about {months:.0f} months of expenses",
            "description":   (
                f"If your income stopped today, your current savings would last roughly {months:.0f} months "
                f"at your current spending pace. {top_driver['category']} is the category that changes "
                f"the most — spending less there would stretch your savings further."
            ),
            "dollar_impact": 0,
            "confidence":    "HIGH" if months < 6 else "MEDIUM",
            "action_option": f"One option would be spending less on {top_driver['category']} to make your savings last longer." if months < 12 else None,
            "tool_source":   "cross_reference",
        })


    if cross_refs:
        print(f"Cross-referenced {len(cross_refs)} compound insights")

    return cross_refs



####################################
# STEP 3: RANK BY DOLLAR IMPACT
####################################

def rank_insights_by_impact(insights: list) -> list:

    # dollar impact descending, then confidence
    confidence_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}

    return sorted(
        insights,
        key=lambda x: (-x.get("dollar_impact", 0), confidence_order.get(x.get("confidence", "LOW"), 3)),
    )



####################################
# STEP 4: VALIDATE FRAMING
####################################

def validate_insight_framing(insight: dict) -> bool:
    """
    Reject insights that moralize or prescribe.
    """

    text = f"{insight.get('title', '')} {insight.get('description', '')} {insight.get('action_option', '')}".lower()

    for word in BANNED_WORDS:
        if word in text:
            print(f"Rejected insight — contains '{word}': {insight.get('title', '')}")
            return False

    # reject insights that suggest cutting essentials
    for cat in ESSENTIAL_CATEGORIES:
        if f"reduce {cat}" in text or f"cut {cat}" in text or f"lower {cat}" in text:
            print(f"Rejected insight — targets essential '{cat}': {insight.get('title', '')}")
            return False

    return True



####################################
# STEP 5: DEDUPLICATE INSIGHTS
####################################

def _deduplicate_insights(insights: list) -> list:
    """
    Remove duplicate insights that cover the same pattern/category.
    Cross-reference insights (tool_source="cross_reference") are preferred
    over LLM-generated ones because they're grounded in real data.
    """

    seen_categories = set()
    deduped = []

    # sort so cross_reference insights come first (they're more trustworthy)
    prioritized = sorted(insights, key=lambda x: 0 if x.get("tool_source") == "cross_reference" else 1)

    for insight in prioritized:
        title = insight.get("title", "").lower()
        desc  = insight.get("description", "").lower()
        text  = f"{title} {desc}"

        # extract all matching topics — dedup if ANY key was already seen
        keys = _extract_insight_keys(text)

        if keys and any(k in seen_categories for k in keys) and len(deduped) >= 3:
            overlap = [k for k in keys if k in seen_categories][0]
            print(f"Deduped insight (overlaps with '{overlap}'): {insight.get('title', '')[:60]}")
            continue

        for k in keys:
            seen_categories.add(k)
        deduped.append(insight)

    removed = len(insights) - len(deduped)
    if removed > 0:
        print(f"Deduplicated {removed} overlapping insights")

    return deduped


def _extract_insight_keys(text: str) -> list:
    """Extract all matching topics from insight text for dedup comparison.
    Returns a list of keys so an insight about 'payday + dining' is deduped
    against both 'payday' and 'dining' insights independently.
    """

    topic_keywords = [
        "subscription", "streaming", "payday", "weekend",
        "dining", "delivery", "shopping", "entertainment",
        "grocery", "transport", "correlation", "price creep",
        "runway", "resilience",
    ]

    return [kw for kw in topic_keywords if kw in text]



####################################
# STEP 6: FACT-CHECK DOLLAR IMPACTS
####################################

def _fact_check_dollar_impacts(insights: list, tool_results: dict) -> list:
    """
    Validate that LLM-claimed dollar impacts are plausible given actual tool data.
    Reject or zero-out impacts that don't match underlying computations.
    """

    # extract verifiable dollar amounts from tool results
    known_amounts = _extract_known_amounts(tool_results)

    checked = []
    for insight in insights:
        impact = insight.get("dollar_impact", 0)

        # skip cross-reference insights (already computed from real data)
        if insight.get("tool_source") == "cross_reference":
            checked.append(insight)
            continue

        # skip if no dollar impact claimed
        if not impact or impact == 0:
            checked.append(insight)
            continue

        # check if the claimed impact is plausible
        if known_amounts and impact > max(known_amounts) * 2:
            print(f"Fact-check: Capped implausible impact ${impact} -> ${max(known_amounts)} for: {insight.get('title', '')[:50]}")
            insight["dollar_impact"] = max(known_amounts)
            insight["confidence"] = "MEDIUM"  # downgrade confidence

        checked.append(insight)

    return checked


def _extract_known_amounts(tool_results: dict) -> list:
    """Pull verifiable dollar amounts from tool outputs for fact-checking."""

    amounts = []

    # subscription totals
    subs = tool_results.get("subscription_hunter", {})
    if subs.get("recurring"):
        for sub in subs["recurring"]:
            if sub.get("annual_cost"):
                amounts.append(sub["annual_cost"])
    if subs.get("overlaps"):
        for overlap in subs["overlaps"]:
            if overlap.get("combined_annual"):
                amounts.append(overlap["combined_annual"])

    # price creep totals
    if subs.get("price_creep"):
        for pc in subs["price_creep"]:
            if pc.get("annual_cost_increase"):
                amounts.append(pc["annual_cost_increase"])

    # spending impact — monthly averages annualized
    impact = tool_results.get("spending_impact", {})
    if impact.get("impacts"):
        for imp in impact["impacts"]:
            avg = imp.get("monthly_avg", 0)
            if avg > 0:
                amounts.append(avg * 12)

    return amounts



####################################
# SAVINGS PLAN
####################################

def _savings_thresholds(profile: dict, monthly_spending: float) -> dict:
    """
    Anchored to the 50/30/20 rule: target saving 20% of income.
    The further below 20% you are, the more aggressively we suggest cutting.
    Clamped 10-20% so suggestions stay realistic.
    """
    income = profile.get("monthly_income", 0)
    base   = income if income > 0 else monthly_spending

    if base <= 0:
        return {"min_monthly": 10, "cut_pct": 0.15, "min_annual": 20}

    # min_monthly: skip categories below 2% of base (floor $10, cap $50)
    min_monthly = min(50, max(10, round(base * 0.02)))

    # cut_pct: based on gap to 20% savings rate
    #   saving  5% -> cut 20%  (far from target, push harder)
    #   saving 10% -> cut 20%  (still behind)
    #   saving 15% -> cut 15%  (almost there, moderate)
    #   saving 20% -> cut 10%  (at target, just optimize)
    #   saving 30% -> cut 10%  (above target, light touch)
    if income > 0:
        savings_rate = max(0, (income - monthly_spending) / income)
        cut_pct = min(0.20, max(0.10, 0.30 - savings_rate))
    else:
        cut_pct = 0.15  # no income data — middle ground

    # min_annual: skip opportunities below 0.5% of yearly base (floor $20, cap $100)
    min_annual = min(100, max(20, round(base * 12 * 0.005)))

    return {"min_monthly": min_monthly, "cut_pct": cut_pct, "min_annual": min_annual}


def generate_savings_plan(df, results: dict, profile: dict = None) -> dict:
    """
    Concrete savings opportunities from analysis + transaction data.
    No LLM call — pure computation.
    Thresholds adapt to income when available.
    """
    profile = profile or {}
    monthly_spending = profile.get("monthly_spending", 0) or profile.get("monthly_average", 0)
    thresh = _savings_thresholds(profile, monthly_spending)

    opportunities = []


    # 1. subscription overlaps
    subs = results.get("subscription_hunter", {})
    if subs.get("overlaps"):
        for overlap in subs["overlaps"]:
            savings = overlap.get("potential_savings", 0)
            if savings > 0:
                opportunities.append({
                    "title":          f"Consolidate {overlap['category']} subscriptions",
                    "annual_savings": round(savings, 2),
                    "detail":         f"{overlap['count']} overlapping services at ${overlap.get('combined_annual', 0):.0f}/yr combined",
                    "type":           "subscription",
                })


    # 2. price creep
    if subs.get("price_creep"):
        for pc in subs["price_creep"]:
            if pc.get("price_creep_detected") and pc.get("annual_cost_increase", 0) > 10:
                opportunities.append({
                    "title":          f"{pc['merchant']} price increase",
                    "annual_savings": round(pc["annual_cost_increase"], 2),
                    "detail":         f"Was ${pc.get('original_price', 0):.2f}/mo, now ${pc.get('current_price', 0):.2f}/mo",
                    "type":           "price_creep",
                })


    # 3. top discretionary categories — with merchant breakdown
    cut_pct = thresh["cut_pct"]
    cut_label = f"{int(cut_pct * 100)}%"

    impact = results.get("spending_impact", {})
    if impact.get("model_valid") and impact.get("impacts"):

        for imp in impact["impacts"]:
            cat = imp["category"]
            if cat.lower() not in DISCRETIONARY_CATEGORIES:
                continue

            avg = imp.get("monthly_avg", 0)
            if avg < thresh["min_monthly"]:
                continue

            # top merchants in this category
            cat_txns = df[df["category"].fillna("").str.lower() == cat.lower()]
            top_merchants = (
                cat_txns.groupby("merchant")["amount"]
                .sum()
                .sort_values(ascending=False)
                .head(3)
                .index.tolist()
            )

            annual = round(avg * cut_pct * 12, 2)
            if annual < thresh["min_annual"]:
                continue

            opportunities.append({
                "title":           f"Reduce {cat} by {cut_label}",
                "annual_savings":  annual,
                "detail":          f"Currently ${avg:.0f}/mo. Top: {', '.join(top_merchants)}",
                "merchants":       top_merchants,
                "current_monthly": round(avg, 2),
                "type":            "discretionary",
            })


    # 4. fallback — derive opportunities directly from transaction data
    #    when spending_impact didn't run or produced nothing usable
    if not opportunities and len(df) > 0:
        cat_col = "category"
        if cat_col in df.columns:
            df_copy = df.copy()
            df_copy["date"] = pd.to_datetime(df_copy["date"], errors="coerce")
            df_copy = df_copy.dropna(subset=["date"])

            if len(df_copy) > 0:
                n_months = max(
                    1,
                    (df_copy["date"].max() - df_copy["date"].min()).days / 30.0,
                )
                cat_totals = (
                    df_copy[df_copy[cat_col].fillna("").str.lower().isin(DISCRETIONARY_CATEGORIES)]
                    .groupby(df_copy[cat_col].str.lower())["amount"]
                    .sum()
                    .sort_values(ascending=False)
                )

                for cat, total_spent in cat_totals.items():
                    monthly_avg = total_spent / n_months
                    if monthly_avg < thresh["min_monthly"]:
                        continue

                    cat_txns = df_copy[df_copy[cat_col].fillna("").str.lower() == cat]
                    top_merchants = (
                        cat_txns.groupby("merchant")["amount"]
                        .sum()
                        .sort_values(ascending=False)
                        .head(3)
                        .index.tolist()
                    )

                    annual = round(monthly_avg * cut_pct * 12, 2)
                    if annual < thresh["min_annual"]:
                        continue

                    opportunities.append({
                        "title":           f"Reduce {cat.title()} by {cut_label}",
                        "annual_savings":  annual,
                        "detail":          f"Currently ~${monthly_avg:.0f}/mo. Top: {', '.join(top_merchants)}",
                        "merchants":       top_merchants,
                        "current_monthly": round(monthly_avg, 2),
                        "type":            "discretionary",
                    })


    # rank by impact, keep top 5
    opportunities.sort(key=lambda x: x["annual_savings"], reverse=True)
    opportunities = opportunities[:5]

    total = sum(o["annual_savings"] for o in opportunities)

    if not opportunities:
        return {"total_annual_savings": 0, "opportunities": []}

    return {
        "total_annual_savings": round(total, 2),
        "opportunities":        opportunities,
    }
