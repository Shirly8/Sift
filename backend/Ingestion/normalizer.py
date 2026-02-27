"""
Clean merchant names and validate transaction data
"""

import re
import pandas as pd


# prefixes to strip from raw bank descriptions
STRIP_PREFIXES = [
    r"^debit card purchase\s*-\s*",
    r"^purchase\s*-\s*",
    r"^e-transfer (from|to)\s+",
    r"^interac e-transfer\s+",
    r"^pos purchase\s*-\s*",
    r"^online payment\s*-\s*",
    r"^preauth(orized)?\s+",
]

# "STARBUCKS #1234 ON 5TH ST" -> "STARBUCKS"
CHAIN_PATTERN = re.compile(r"\s+#\d+.*$|\s+\d{3,}.*$|\s+store\s+.*$", re.IGNORECASE)

# "AMAZON.COM*MX123456" -> "AMAZON.COM"
# requires at least one digit — avoids stripping real words like "HORTONS"
ONLINE_PATTERN = re.compile(r"[*\s]+[A-Z0-9]*\d[A-Z0-9]{4,}$")



####################################
# STEP 1: CLEAN MERCHANT NAME
####################################

def clean_merchant_name(merchant: str) -> str:
    """
    remove prefix and location
    ("DEBIT CARD PURCHASE - STARBUCKS #1234 ON KING ST") -> "STARBUCKS"
    """

    m = merchant.strip().upper()

    for pattern in STRIP_PREFIXES:
        m = re.sub(pattern, "", m, flags=re.IGNORECASE).strip()

    m = ONLINE_PATTERN.sub("", m).strip()
    m = CHAIN_PATTERN.sub("", m).strip()
    m = re.sub(r"[\s\-,./]+$", "", m).strip()

    # fallback: return original if we stripped everything
    if not m:
        original = merchant.strip().upper()
        return original if original else "UNKNOWN"
    return m



####################################
# STEP 2: DEDUPLICATE
####################################

def deduplicate_transactions(df: pd.DataFrame) -> pd.DataFrame:
    """
    Remove true duplicates (identical rows imported twice) while preserving
    legitimate repeat transactions (e.g. two coffees at Starbucks in one day).

    Strategy: allow up to 2 transactions with the same (date, amount, merchant).
    """

    before = len(df)

    # count occurrences within each (date, amount, merchant) group
    # three is almost certainly a CSV import artifact
    
    df["_dup_rank"] = df.groupby(["date", "amount", "merchant"]).cumcount()
    df = df[df["_dup_rank"] < 2].drop(columns=["_dup_rank"])

    removed = before - len(df)
    if removed > 0:
        print(f"Removed {removed} duplicate transactions")

    return df.reset_index(drop=True)



####################################
# STEP 3: VALIDATE DATE RANGE
####################################

def validate_date_range(df: pd.DataFrame) -> tuple:

    dates      = pd.to_datetime(df["date"])
    start_date = dates.min()
    end_date   = dates.max()
    span_days  = (end_date - start_date).days

    if span_days < 7:
        print(f"Warning: Only {span_days} days of data — analysis may be limited")

    print(f"Date range: {start_date.date()} → {end_date.date()} ({span_days} days)")
    return start_date, end_date



