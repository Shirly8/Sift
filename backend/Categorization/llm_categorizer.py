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

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
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

def categorize_with_llm(merchant: str, context_category: str = None) -> dict:

    prompt = f"""Categorize this merchant into exactly one of: {', '.join(CATEGORIES)}

Merchant: {merchant}
{f'Hint from rule engine: {context_category}' if context_category else ''}

Return JSON only, no explanation outside JSON:
{{"category": "...", "confidence": 0.0-1.0, "reasoning": "one sentence"}}"""

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

        # map results by merchant name for lookup
        result_map = {}
        for item in parsed:
            m = item.get("merchant", "")
            if item.get("category") not in CATEGORIES:
                item["category"]   = "Uncategorized"
                item["confidence"] = 0.0
            result_map[m.upper()] = item

        # ensure every input merchant has a result
        results = []
        for m in merchants:
            if m.upper() in result_map:
                r = result_map[m.upper()]
                r["merchant"] = m
                results.append(r)
            else:
                r = categorize_with_llm(m)
                r["merchant"] = m
                results.append(r)

        return results

    except (ConnectionError, TimeoutError, RuntimeError) as e:
        # connection/auth errors — don't retry individually, it'll fail the same way
        print(f"Batch LLM call failed (connection): {e} — marking all as Uncategorized")
        return [
            {"merchant": m, "category": "Uncategorized", "confidence": 0.0, "reasoning": f"LLM unavailable: {e}"}
            for m in merchants
        ]

    except Exception:
        # parsing/format errors — try individually (LLM might work with simpler prompts)
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

    return df[["merchant", "category", "confidence", "reasoning"]]



