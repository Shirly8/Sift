"""
Persistent merchant -> category cache. Avoids re-querying LLM for known merchants.
User corrections are saved at 0.99 confidence and always override rule/LLM results.

  lookup_merchant("STARBUCKS")
  -> ("Dining", 0.95, False)

  update_from_user_correction("SP * ETSY", "Shopping")
  lookup_merchant("SP * ETSY")
  -> ("Shopping", 0.99, True)
"""

import os
import json
from datetime import datetime


DB_PATH          = os.path.join(os.path.dirname(__file__), "../Data/merchant_cache.json")
EXPORT_THRESHOLD = 50    # min user corrections per category before exporting as rules



####################################
# STEP 1: LOAD DB
####################################

def load_merchant_db(file_path: str = DB_PATH) -> dict:

    if not os.path.exists(file_path):
        return {}

    with open(file_path, "r") as f:
        return json.load(f)



####################################
# STEP 2: LOOKUP MERCHANT
####################################

def lookup_merchant(merchant: str, db: dict = None) -> tuple:

    if db is None:
        db = load_merchant_db()

    entry = db.get(merchant.upper())
    if not entry:
        return None, 0.0, False

    # user-verified corrections always override
    confidence = 0.99 if entry.get("user_verified") else entry.get("confidence", 0.8)

    return entry["category"], confidence, entry.get("user_verified", False)



####################################
# STEP 3: LEARN FROM USER CORRECTION
####################################

def update_from_user_correction(merchant: str, correct_category: str, db_path: str = DB_PATH):

    db = load_merchant_db(db_path)

    db[merchant.upper()] = {
        "category":      correct_category,
        "confidence":    0.99,
        "last_verified": datetime.now().strftime("%Y-%m-%d"),
        "user_verified": True,
    }

    _save_db(db, db_path)
    print(f"Learned: {merchant} -> {correct_category}")



####################################
# STEP 4: SAVE RESULT TO CACHE
####################################

def save_to_cache(merchant: str, category: str, confidence: float, db_path: str = DB_PATH):

    db = load_merchant_db(db_path)

    # never overwrite user-verified entries
    existing = db.get(merchant.upper(), {})
    if existing.get("user_verified"):
        return

    db[merchant.upper()] = {
        "category":      category,
        "confidence":    confidence,
        "last_verified": datetime.now().strftime("%Y-%m-%d"),
        "user_verified": False,
    }

    _save_db(db, db_path)



####################################
# STEP 5: EXPORT LEARNED RULES
####################################

def export_learned_rules(db_path: str = DB_PATH) -> dict:

    db = load_merchant_db(db_path)

    category_counts    = {}
    category_merchants = {}

    for merchant, entry in db.items():
        if not entry.get("user_verified"):
            continue

        cat = entry["category"]
        category_counts[cat]    = category_counts.get(cat, 0) + 1
        category_merchants[cat] = category_merchants.get(cat, []) + [merchant]

    # only export categories that hit the threshold
    exportable = {
        cat: merchants
        for cat, merchants in category_merchants.items()
        if category_counts[cat] >= EXPORT_THRESHOLD
    }

    if exportable:
        print(f"Exportable learned rules: {list(exportable.keys())}")

    return exportable



def _save_db(db: dict, db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with open(db_path, "w") as f:
        json.dump(db, f, indent=2)
