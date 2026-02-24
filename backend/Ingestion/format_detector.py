"""
Detect bank CSV format and normalize schema

Input:  Raw CSV


Output: DataFrame -> {date, amount, merchant, category}
    detect_csv_format("transactions.csv")
    -> "wealthsimple"

    normalize_to_standard(df, "wealthsimple")
  ->  date        | amount |  merchant
      2024-03-02  | 87.43  |  LOBLAWS
      2024-03-03  | 8.50   |  STARBUCKS #1234 ON KING ST
"""

import pandas as pd


BANK_SCHEMAS = {
    "wealthsimple_cash": ["date", "transaction", "description", "amount"],
    "wealthsimple":      ["transaction date", "description", "amount"],
    "rbc":               ["transaction date", "posting date", "activity description"],
    "td":                ["date", "description", "debit", "credit"],
    "bmo":               ["date", "description", "amount"],
}

COLUMN_MAP = {
    "wealthsimple_cash": {"date": "date",             "amount": "amount",     "merchant": "description"},
    "wealthsimple":      {"date": "transaction date", "amount": "amount",     "merchant": "description"},
    "rbc":               {"date": "posting date",     "amount": "amount ($)",     "merchant": "activity description"},
    "td":                {"date": "date",             "amount": "debit",      "merchant": "description"},
    "bmo":               {"date": "date",             "amount": "amount",     "merchant": "description"},
    "generic":           {"date": None,               "amount": None,         "merchant": None},
}

TRANSACTION_TYPE_FILTERS = {
    "wealthsimple_cash": ("transaction", "SPEND"), # "transaction" column has SPEND for spending analysis
}



####################################
# STEP 1: DETECT FORMAT TO FIND BANK
####################################

def detect_csv_format(file_path: str) -> str:

    df      = pd.read_csv(file_path, nrows=5)
    headers = [col.strip().lower() for col in df.columns]

    best_match = "generic" 
    best_score = 0

    for bank, required_cols in BANK_SCHEMAS.items():
        matched = sum(1 for col in required_cols if col in headers)
        score   = matched / len(required_cols)

        if score > best_score:
            best_score = score
            best_match = bank

    # confidence threshold: 80%
    if best_score < 0.8:
        best_match = "generic"

    print(f"Detected bank format: {best_match} (confidence: {best_score:.0%})")
    return best_match



####################################
# STEP 2: VALIDATE STRUCTURE
####################################

def validate_csv_structure(df: pd.DataFrame, format_type: str) -> bool:

    headers = [col.strip().lower() for col in df.columns]

    if format_type == "generic":
        needed  = ["amount"]
        missing = [col for col in needed if not any(col in h for h in headers)]
    else:
        needed  = BANK_SCHEMAS.get(format_type, [])
        missing = [col for col in needed if col not in headers]



    if missing:
        raise ValueError(f"Missing required columns for {format_type}: {missing}")

    return True


def _clean_amount(series):
    """Remove currency symbols and commas from amount strings (e.g., '$1,234.56' -> '1234.56')"""
    return series.astype(str).str.replace(r'[$,]', '', regex=True)


####################################
# STEP 3: NORMALIZE TO SCHEMA
####################################

def normalize_to_standard(df: pd.DataFrame, format_type: str) -> pd.DataFrame:

    df.columns = [col.strip().lower() for col in df.columns]

    mapping = COLUMN_MAP.get(format_type, COLUMN_MAP["generic"])

    # generic: best-effort column guessing
    if format_type == "generic":
        mapping = _guess_columns(df.columns.tolist())

    # filter to spending rows only (e.g. wealthsimple_cash has INT/SPEND/etc.)
    if format_type in TRANSACTION_TYPE_FILTERS:
        type_col, type_val = TRANSACTION_TYPE_FILTERS[format_type]
        if type_col in df.columns:
            before = len(df)
            df     = df[df[type_col].str.upper() == type_val.upper()].copy()
            print(f"Filtered to {type_val} transactions: {len(df)}/{before} rows kept")

    out = pd.DataFrame()

    # DATE -> format yyyy-mm-dd
    date_col = mapping["date"]
    if date_col and date_col in df.columns:
        out["date"] = pd.to_datetime(df[date_col], errors="coerce")

        bad_dates = out["date"].isna().sum()
        if bad_dates / len(df) > 0.05:
            raise ValueError(f"Date parsing failed on {bad_dates}/{len(df)} rows — check format")

        out["date"] = out["date"].dt.strftime("%Y-%m-%d")


    # AMOUNT — abs() handles banks that export debits as negatives
    # strips currency symbols (e.g., '$1,234.56' -> '1234.56')
    # TD has separate debit/credit columns — combine them

    amount_col = mapping["amount"]
    if amount_col and amount_col in df.columns:
        amount_series = pd.to_numeric(_clean_amount(df[amount_col]), errors="coerce")

        # TD: fill missing debits with credit column
        if format_type == "td" and "credit" in df.columns:
            credit_series = pd.to_numeric(_clean_amount(df["credit"]), errors="coerce")
            amount_series = amount_series.fillna(credit_series)

        out["amount"] = amount_series.abs()


    # MERCHANT
    merchant_col = mapping["merchant"]
    if merchant_col and merchant_col in df.columns:
        out["merchant"] = df[merchant_col].astype(str)

    out["category"] = ""

    out = out.dropna(subset=["date", "amount"])

    print(f"Normalized {len(out)} transactions from {format_type} format")
    return out



def _guess_columns(headers: list) -> dict:

    mapping = {"date": None, "amount": None, "merchant": None}

    for h in headers:
        if any(kw in h for kw in ["date", "posted", "time"]):
            mapping["date"] = h
        elif any(kw in h for kw in ["amount", "debit", "withdrawal", "charge"]):
            mapping["amount"] = h
        elif any(kw in h for kw in ["merchant", "description", "payee", "name"]):
            mapping["merchant"] = h

    return mapping
