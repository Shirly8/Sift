"""
Before LLM fallback, see if we can classify ourselves

  categorize_merchant("STARBUCKS", rules)  ->  ("Dining", 0.95)
  categorize_merchant("XYZ CORP", rules)   ->  (None, 0.0)   <- falls through to LLM

  batch_categorize(merchants, rules)
  -> Rule categorization: 262/280 merchants (94% coverage)
"""

import re
import json
import pandas as pd
from pathlib import Path

from Categorization.constants import RULE_EXACT_CONFIDENCE, RULE_WORD_CONFIDENCE, RULE_SUBSTRING_CONFIDENCE


_RULES_PATH = Path(__file__).parent / "rules.json"



####################################
# STEP 1: BUILD ENGINE
####################################

def _normalize(s: str) -> str:
    """Strip punctuation that varies across bank formats before comparing.
    "LONGO'S" -> "LONGOS",  "WAL-MART" -> "WALMART",  "MR. SUB" -> "MR SUB"
    """
    return re.sub(r"['\-\.]", "", s.upper())


def build_rule_engine(path=None) -> dict:
    p = Path(path) if path else _RULES_PATH
    with open(p) as f:
        return json.load(f)



####################################
# STEP 2: CATEGORIZE ONE MERCHANT
####################################

def categorize_merchant(merchant: str, rules: dict) -> tuple:

    m      = merchant.strip().upper()
    m_norm = _normalize(m)

    for category, keywords in rules.items():
        for kw in keywords:
            kw_norm = _normalize(kw)

            # exact match
            if m_norm == kw_norm:
                return category, RULE_EXACT_CONFIDENCE

            # whole-word match
            if re.search(r'\b' + re.escape(kw_norm) + r'\b', m_norm):
                return category, RULE_WORD_CONFIDENCE

            # substring match
            if kw_norm in m_norm:
                return category, RULE_SUBSTRING_CONFIDENCE

    return None, 0.0



####################################
# STEP 3: BATCH CATEGORIZE
####################################

def batch_categorize(merchants: list, rules: dict) -> pd.DataFrame:

    results = []
    for merchant in merchants:
        category, confidence = categorize_merchant(merchant, rules)
        results.append({
            "merchant":   merchant,
            "category":   category,
            "confidence": confidence,
        })

    df = pd.DataFrame(results)

    categorized = df["category"].notna().sum()
    coverage    = categorized / len(df) if len(df) > 0 else 0

    print(f"Rule categorization: {categorized}/{len(df)} merchants ({coverage:.0%} coverage)")

    if coverage < 0.4:
        print("Warning: Low rule coverage. LLM fallback will be heavy")

    return df
