"""
LLM fallback for merchants the rule engine cannot categorize

  categorize_with_llm("AMZ*WHOLEFDS")
  -> {"category": "Groceries", "confidence": 0.92, "reasoning": "Amazon Whole Foods is a grocery retailer"}

  categorize_with_llm("SP * ETSY")
  -> {"category": "Shopping", "confidence": 0.61, "reasoning": "Etsy is an online marketplace"}  <- flagged for review

Uses LLM/client.py — works with Ollama, Claude, OpenAI, or Gemini.
"""

import json
import time
import pandas as pd

from LLM.client import call_llm, extract_json


CATEGORIES = [
    "Groceries", "Delivery", "Dining", "Transport", "Subscriptions",
    "Shopping", "Entertainment", "Health", "Bills & Utilities",
    "Rent & Housing", "Education", "Insurance", "Personal Care",
    "Income", "Transfer", "Uncategorized",
]

BATCH_SIZE = 10   # merchants per LLM call (keeps prompt focused)



####################################
# STEP 1: CLASSIFY ONE MERCHANT
####################################

def categorize_with_llm(merchant: str) -> dict:

    prompt = f"""Categorize this merchant into exactly one of: {', '.join(CATEGORIES)}

        Merchant: {merchant}

        Return JSON only, no explanation outside JSON:
        {{"category": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}}
        """

    try:
        raw    = call_llm(prompt, temperature=0.0, max_tokens=120)
        result = json.loads(extract_json(raw))

        if result.get("category") not in CATEGORIES:
            result["category"]   = "Uncategorized"
            result["confidence"] = 0.0

        return result

    except Exception as e:
        return {"category": "Uncategorized", "confidence": 0.0, "reasoning": str(e)}



####################################
# STEP 2: BATCH CLASSIFY (multi-merchant per call)
####################################

def _categorize_batch(merchants: list) -> list:
    """Classify multiple merchants in a single LLM call."""

    numbered = "\n".join(f"{i+1}. {m}" for i, m in enumerate(merchants))

    prompt = f"""Categorize each merchant into exactly one of: {', '.join(CATEGORIES)}

        Merchants:
        {numbered}

        Return a JSON array with one object per merchant, in order:
        [{{"merchant": "...", "category": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}}]"""

    try:
        raw    = call_llm(prompt, temperature=0.0, max_tokens=150 * len(merchants))
        parsed = json.loads(extract_json(raw))

        if not isinstance(parsed, list):
            parsed = [parsed]

        # map by merchant name for lookup
        result_map = {item.get("merchant", "").upper(): item for item in parsed}

        results = []
        for m in merchants:
            r = result_map.get(m.upper()) or categorize_with_llm(m)
            if r.get("category") not in CATEGORIES:
                r["category"]   = "Uncategorized"
                r["confidence"] = 0.0
            r["merchant"] = m
            results.append(r)

        return results

    except Exception as e:
        print(f"Batch failed: {e} — falling back to individual")
        results = []
        for m in merchants:
            r = categorize_with_llm(m)
            r["merchant"] = m
            results.append(r)
        return results


def batch_categorize_llm(merchants: list) -> pd.DataFrame:

    results = []
    chunks  = [merchants[i:i+BATCH_SIZE] for i in range(0, len(merchants), BATCH_SIZE)]

    for chunk_idx, chunk in enumerate(chunks):
        print(f"LLM batch {chunk_idx+1}/{len(chunks)} ({len(chunk)} merchants)...")

        batch_results = _categorize_batch(chunk)
        results.extend(batch_results)

        if chunk_idx < len(chunks) - 1:
            time.sleep(0.3)

    df = pd.DataFrame(results)
    print(f"LLM batch done — {len(df)} merchants classified")

    return df[["merchant", "category", "confidence"]]



