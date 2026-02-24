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
from LLM.client import extract_json


# words that should NEVER appear in insights
BANNED_WORDS = ["should", "bad", "problem", "waste", "too much", "excessive"]



####################################
# STEP 1: SYNTHESIZE INSIGHTS
####################################

def synthesize_insights(tool_results: dict, profile: dict, llm_call=None) -> list:
    """
    Two modes:
      - With LLM: pass results to Claude for natural language synthesis
      - Without LLM: build insights directly from tool outputs (works offline)

    Both modes run cross-referencing after individual tool insights.
    """

    if llm_call:
        insights = _synthesize_with_llm(tool_results, profile, llm_call)
    else:
        insights = _synthesize_local(tool_results, profile)

    # cross-reference: find connections BETWEEN tools that individual tools can't see
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

RESULTS:
{json.dumps(tool_results, indent=2, default=str)}

DATA PROFILE:
{json.dumps(profile, indent=2)}

Return JSON array only: [{{"title": "...", "description": "...", "dollar_impact": 0, "confidence": "HIGH", "action_option": "...", "tool_source": "..."}}]"""

    try:
        raw      = llm_call(prompt, temperature=0.3, max_tokens=1500)
        insights = json.loads(extract_json(raw))

        # validate framing
        insights = [i for i in insights if validate_insight_framing(i)]

        return insights

    except Exception as e:
        print(f"LLM synthesis failed ({e}) — falling back to local")
        return _synthesize_local(tool_results, profile)



def _synthesize_local(tool_results: dict, profile: dict) -> list:
    """
    Build insights directly from tool outputs — no LLM needed
    """

    insights = []


    # subscription insights
    subs = tool_results.get("subscription_hunter", {})

    if subs.get("recurring"):
        recurring     = subs["recurring"]
        total_monthly = sum(r["amount"] for r in recurring)
        total_annual  = sum(r["annual_cost"] for r in recurring)

        insights.append({
            "title":         f"{len(recurring)} active subscriptions at ${total_monthly:.2f}/month",
            "description":   f"Your recurring charges total ${total_annual:.2f}/year across {len(recurring)} services.",
            "dollar_impact": round(total_annual, 2),
            "confidence":    "HIGH",
            "action_option": "Review each subscription to confirm it's still providing value.",
            "tool_source":   "subscription_hunter",
        })

    if subs.get("overlaps"):
        for overlap in subs["overlaps"]:
            insights.append({
                "title":         f"{overlap['count']} overlapping {overlap['category']} subscriptions",
                "description":   f"Combined cost: ${overlap['combined_annual']:.2f}/year.",
                "dollar_impact": overlap["potential_savings"],
                "confidence":    "HIGH",
                "action_option": f"One option would be consolidating to fewer {overlap['category']} services.",
                "tool_source":   "subscription_hunter",
            })

    # price creep
    if subs.get("price_creep"):
        for pc in subs["price_creep"]:
            if pc.get("price_creep_detected"):
                insights.append({
                    "title":         f"{pc['merchant']} increased {pc['total_increase_pct']}%",
                    "description":   f"From ${pc['original_price']} to ${pc['current_price']}.",
                    "dollar_impact": pc["annual_cost_increase"],
                    "confidence":    "HIGH",
                    "action_option": f"One option would be reviewing whether {pc['merchant']} still fits your budget.",
                    "tool_source":   "subscription_hunter",
                })


    # temporal insights
    temporal = tool_results.get("temporal_patterns", {})

    payday = temporal.get("payday", {})
    if payday.get("payday_detected"):
        pct = payday["spending_in_first_7_days_pct"]
        insights.append({
            "title":         f"{pct}% of spending within 7 days of payday",
            "description":   f"This pattern held across {payday['cycles_analyzed']} payday cycles.",
            "dollar_impact": 0,
            "confidence":    "HIGH" if payday["confidence"] > 0.8 else "MEDIUM",
            "action_option": "Consider whether this front-loading is intentional.",
            "tool_source":   "temporal_patterns",
        })

    weekly = temporal.get("weekly", {})
    if weekly.get("weekend_spending_multiple", 1.0) > 1.3:
        mult = weekly["weekend_spending_multiple"]
        insights.append({
            "title":         f"Weekend spending is {mult}x weekday average",
            "description":   f"Highest: {weekly['highest_spending_day']}, Lowest: {weekly['lowest_spending_day']}.",
            "dollar_impact": 0,
            "confidence":    "MEDIUM",
            "action_option": None,
            "tool_source":   "temporal_patterns",
        })


    # anomaly insights
    anomalies = tool_results.get("anomaly_detection", {})

    outliers = anomalies.get("outliers", [])
    if outliers:
        top = outliers[0]
        insights.append({
            "title":         f"Unusual transaction: {top['merchant']} — ${top['amount']}",
            "description":   f"This is {top['z_score']}x the standard deviation for {top['category']} (avg ${top['category_avg']}).",
            "dollar_impact": 0,
            "confidence":    "HIGH",
            "action_option": None,
            "tool_source":   "anomaly_detection",
        })

    spikes = anomalies.get("spending_spikes", [])
    for spike in spikes[:2]:
        excess = round(spike["recent_month_total"] - spike["prior_avg"], 2)
        insights.append({
            "title":         f"{spike['category']} spiked {spike['spike_pct']:.0f}% last month",
            "description":   f"${spike['recent_month_total']:.2f} vs ${spike['prior_avg']:.2f} average (${excess} above normal).",
            "dollar_impact": excess,
            "confidence":    "MEDIUM",
            "action_option": None,
            "tool_source":   "anomaly_detection",
        })


    # correlation insights
    correlations = tool_results.get("correlation_engine", [])
    if correlations:
        for corr in correlations[:2]:
            insights.append({
                "title":         f"{corr['category_a']} ↔ {corr['category_b']} (r={corr['correlation']})",
                "description":   corr["interpretation"],
                "dollar_impact": 0,
                "confidence":    corr["confidence"],
                "action_option": None,
                "tool_source":   "correlation_engine",
            })


    # impact attribution
    impact = tool_results.get("spending_impact", {})
    if impact.get("model_valid") and impact.get("impacts"):
        top = impact["impacts"][0]
        insights.append({
            "title":         f"{top['category']} drives {top['impact_pct']}% of spending variance",
            "description":   f"Based on {impact['n_months']} months of data.",
            "dollar_impact": 0,
            "confidence":    impact["confidence"],
            "action_option": f"{top['category']} is your highest-leverage category for stabilizing monthly totals.",
            "tool_source":   "spending_impact",
        })


    return insights



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

    return True
