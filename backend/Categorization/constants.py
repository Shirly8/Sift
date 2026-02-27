"""
Categorization confidence thresholds — single source of truth.

The cascade:
  RULE_EXACT (0.95) — exact keyword match, auto-cached
  RULE_WORD  (0.80) — whole-word match, auto-cached
  LLM_DEFAULT (0.75) — LLM-classified, NOT auto-cached (passes re-cat gate, blocks cache)
  RULE_SUBSTRING (0.70) — substring match, triggers re-categorization check
  USER_VERIFIED (0.99) — human correction, always overrides

Gates:
  < RECAT_THRESHOLD  -> flagged for LLM re-categorization
  >= CACHE_THRESHOLD -> auto-saved to merchant cache
"""

RULE_EXACT_CONFIDENCE     = 0.95
RULE_WORD_CONFIDENCE      = 0.80
RULE_SUBSTRING_CONFIDENCE = 0.70

LLM_DEFAULT_CONFIDENCE    = 0.75

USER_VERIFIED_CONFIDENCE  = 0.99

RECAT_THRESHOLD           = 0.70
CACHE_THRESHOLD           = 0.80


# category sets — single source of truth across all tools
# essential: AI must never suggest cutting these
ESSENTIAL_CATEGORIES = {
    "groceries", "grocery", "rent & housing", "health", "insurance",
    "bills & utilities", "education",
}

# discretionary: categories where spending reductions are actionable
DISCRETIONARY_CATEGORIES = {
    "dining", "delivery", "shopping", "entertainment", "personal care",
}
