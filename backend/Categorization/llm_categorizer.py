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

CHUNK_SIZE           = 50
CONFIDENCE_THRESHOLD = 0.7



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
# STEP 2: BATCH CLASSIFY
####################################

def batch_categorize_llm(merchants: list) -> pd.DataFrame:

    results = []
    chunks  = [merchants[i:i+CHUNK_SIZE] for i in range(0, len(merchants), CHUNK_SIZE)]

    for chunk_idx, chunk in enumerate(chunks):
        print(f"LLM batch {chunk_idx+1}/{len(chunks)} ({len(chunk)} merchants)...")

        for merchant in chunk:
            result             = categorize_with_llm(merchant)
            result["merchant"] = merchant
            results.append(result)

        if chunk_idx < len(chunks) - 1:
            time.sleep(0.3)

    df = pd.DataFrame(results)
    print(f"LLM batch done — {len(df)} merchants classified")

    return df[["merchant", "category", "confidence", "reasoning"]]



####################################
# STEP 3: FLAG LOW CONFIDENCE
####################################

def validate_llm_confidence(df: pd.DataFrame, threshold: float = CONFIDENCE_THRESHOLD) -> pd.DataFrame:

    needs_review = df[df["confidence"] < threshold].copy()

    if len(needs_review) > 0:
        print(f"{len(needs_review)} merchants need human review (confidence < {threshold})")

    return needs_review
