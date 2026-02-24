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
    ("DEBIT CARD PURCHASE - STARBUCKS #1234 ON KING ST") -> "STARBUCKS"
    """

    m = merchant.strip().upper()

    for pattern in STRIP_PREFIXES:
        m = re.sub(pattern, "", m, flags=re.IGNORECASE).strip()

    m = ONLINE_PATTERN.sub("", m).strip()
    m = CHAIN_PATTERN.sub("", m).strip()
    m = re.sub(r"[\s\-,./]+$", "", m).strip()

    # fallback: return original if we stripped everything
    return m if m else merchant.strip().upper()



####################################
# STEP 2: DEDUPLICATE
####################################

def deduplicate_transactions(df: pd.DataFrame) -> pd.DataFrame:

    before = len(df)

    # exact dupe: same date + amount + merchant
    df = df.drop_duplicates(subset=["date", "amount", "merchant"], keep="first")

    removed = before - len(df)
    if removed > 0:
        dup_pct = removed / before
        if dup_pct > 0.01:
            print(f"Warning: {removed} duplicates removed ({dup_pct:.1%} of total)")
        else:
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

    # check for missing months (gaps > 30 days)
    monthly         = dates.dt.to_period("M").nunique()
    expected_months = max(1, span_days // 30)
    if monthly < expected_months * 0.8:
        print(f"Warning: Possible missing data — {monthly} months found, expected ~{expected_months}")


    print(f"Date range: {start_date.date()} → {end_date.date()} ({span_days} days)")
    return start_date, end_date



####################################
# STEP 4: DATA QUALITY SCORE
####################################

def calculate_data_quality_score(df: pd.DataFrame) -> float:

    """
    calculate_data_quality_score(df) -> 0.92 (merchant=100%, amount=98%, span=273d)
    """

    total = len(df)
    if total == 0:
        raise ValueError("No transactions found")

    # merchant completeness
    merchant_ok  = df["merchant"].notna() & (df["merchant"].str.strip() != "")
    merchant_pct = merchant_ok.sum() / total


    # amount completeness 
    amount_ok  = df["amount"].notna() & (df["amount"] > 0)
    amount_pct = amount_ok.sum() / total



    # date span — 180 days = full score (0.3 weight)
    dates     = pd.to_datetime(df["date"])
    span_days = (dates.max() - dates.min()).days
    date_pct  = min(span_days / 180, 1.0)

    score = round((merchant_pct * 0.3) + (amount_pct * 0.4) + (date_pct * 0.3), 4)

    if score < 0.5:
        raise ValueError(f"Data quality too low ({score:.2f}) — check your CSV")

    print(f"Data quality score: {score:.2f} (merchant={merchant_pct:.0%}, amount={amount_pct:.0%}, span={span_days}d)")
    return score
