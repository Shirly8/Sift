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
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from LLM.client import call_llm, extract_json


# words that should NEVER appear in insights
BANNED_WORDS = ["should", "bad", "problem", "waste", "too much", "excessive"]

# categories the AI must never suggest cutting — the AI sees numbers, not context
ESSENTIAL_CATEGORIES = {"groceries", "grocery", "rent", "mortgage", "healthcare",
                        "medical", "insurance", "utilities", "childcare", "education"}



####################################
# STEP 1: SYNTHESIZE INSIGHTS
####################################

def synthesize_insights(tool_results: dict, profile: dict, llm_call=None) -> list:
    """
    Synthesize tool outputs into ranked insights via LLM.
    Routes to Claude (prod) or Ollama (local dev) — both go through call_llm.
    Returns [] if LLM is unavailable.
    """

    fn = llm_call or call_llm
    insights = _synthesize_with_llm(tool_results, profile, fn)

    cross_refs = _cross_reference(tool_results)
    insights.extend(cross_refs)

    return rank_insights_by_impact(insights)



def _synthesize_with_llm(tool_results: dict, profile: dict, llm_call) -> list:

    prompt = f"""You are a spending intelligence agent. Analyze these results and generate 3-5 insights.

RULES:
- Each insight must have: title, description, dollar_impact (annual), confidence (HIGH/MEDIUM/LOW), action_option
- Use neutral framing. Never say "should", "bad", "problem", "waste", "too much"
- Frame actions as options: "One option would be..." not "You should..."
- Dollar impact must be calculated from the data, not estimated
- If no dollar impact, set to 0 and confidence to "informational"
- NEVER generate insights that simply restate a category's total spending (e.g. "High Shopping Spend", "High Dining Spend"). The spending bars already show totals — every insight MUST connect 2+ data points or reveal something the charts don't show.
- Each insight must be distinct — no two insights about the same pattern or category
- NEVER suggest reducing essentials: groceries, rent, mortgage, healthcare, medical, insurance, utilities, childcare, education. The AI sees numbers, not whether someone is food-insecure or depends on a service for their wellbeing. Only flag discretionary spending.

RESULTS:
{json.dumps(tool_results, indent=2, default=str)}

DATA PROFILE:
{json.dumps(profile, indent=2, default=str)}

Return JSON array only: [{{"title": "...", "description": "...", "dollar_impact": 0, "confidence": "HIGH", "action_option": "...", "tool_source": "..."}}]"""

    try:
        raw      = llm_call(prompt, temperature=0.3, max_tokens=1500)
        insights = json.loads(extract_json(raw))

        # validate framing
        insights = [i for i in insights if validate_insight_framing(i)]

        return insights

    except Exception as e:
        print(f"LLM synthesis failed ({e}) — returning empty insights")
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
            "title":         f"Post-payday {top_driver['category']} is your biggest swing factor",
            "description":   (
                f"{payday_pct}% of spending happens within 7 days of payday, "
                f"and {top_driver['category']} drives {top_driver['impact_pct']}% of your month-to-month variance. "
                f"Post-payday {top_driver['category']} likely accounts for a large share of your spending swings."
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
                "title":         f"Weekend {top_driver['category']} amplifies your spending variance",
                "description":   (
                    f"Weekends run {mult}x weekday spending, and {top_driver['category']} "
                    f"is your most variable category ({top_driver['impact_pct']}% of variance). "
                    f"Weekend {top_driver['category']} is likely a compound driver."
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
                        "title":         f"{spike_cat} spike may be linked to {related_cat}",
                        "description":   (
                            f"{spike_cat} spiked {spike['spike_pct']:.0f}% last month. "
                            f"{spike_cat} and {related_cat} are positively correlated (r={corr['correlation']}), "
                            f"so {related_cat} spending may have risen too."
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
# SAVINGS PLAN
####################################

def generate_savings_plan(df, results: dict) -> dict:
    """
    Concrete savings opportunities from analysis + transaction data.
    No LLM call — pure computation.
    """

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
    impact = results.get("spending_impact", {})
    if impact.get("model_valid") and impact.get("impacts"):

        # whitelist — only discretionary categories, never essentials
        discretionary_cats = {"dining", "delivery", "shopping", "entertainment", "personal care"}

        for imp in impact["impacts"]:
            cat = imp["category"]
            if cat.lower() not in discretionary_cats:
                continue

            avg = imp.get("monthly_avg", 0)
            if avg < 30:
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

            annual = round(avg * 0.20 * 12, 2)
            if annual < 50:
                continue

            opportunities.append({
                "title":           f"Reduce {cat} by 20%",
                "annual_savings":  annual,
                "detail":          f"Currently ${avg:.0f}/mo. Top: {', '.join(top_merchants)}",
                "merchants":       top_merchants,
                "current_monthly": round(avg, 2),
                "type":            "discretionary",
            })


    # rank by impact, keep top 5
    opportunities.sort(key=lambda x: x["annual_savings"], reverse=True)
    opportunities = opportunities[:5]

    total = sum(o["annual_savings"] for o in opportunities)

    if not opportunities:
        return None

    return {
        "total_annual_savings": round(total, 2),
        "opportunities":        opportunities,
    }
