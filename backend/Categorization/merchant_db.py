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
from filelock import FileLock

from Categorization.constants import USER_VERIFIED_CONFIDENCE, CACHE_THRESHOLD


DB_PATH = os.path.join(os.path.dirname(__file__), "../Data/merchant_cache.json")
_LOCK  = FileLock(DB_PATH + ".lock", timeout=5)



####################################
# STEP 1: LOAD DB
####################################

def load_merchant_db(file_path: str = DB_PATH) -> dict:

    if not os.path.exists(file_path):
        return {}

    with _LOCK:
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
    confidence = USER_VERIFIED_CONFIDENCE if entry.get("user_verified") else entry.get("confidence", CACHE_THRESHOLD)

    return entry["category"], confidence, entry.get("user_verified", False)



####################################
# STEP 3: LEARN FROM USER CORRECTION
####################################

def update_from_user_correction(merchant: str, correct_category: str, db_path: str = DB_PATH):

    db = load_merchant_db(db_path)

    db[merchant.upper()] = {
        "category":      correct_category,
        "confidence":    USER_VERIFIED_CONFIDENCE,
        "last_verified": datetime.now().strftime("%Y-%m-%d"),
        "user_verified": True,
    }

    _save_db(db, db_path)
    print(f"Learned: {merchant} -> {correct_category}")



####################################
# STEP 4: SAVE DB
####################################

def _save_db(db: dict, db_path: str):
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    with _LOCK:
        with open(db_path, "w") as f:
            json.dump(db, f, indent=2)
