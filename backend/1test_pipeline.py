"""
Flow:  CSV -> detect format -> normalize -> clean -> validate -> rule categorize -> merchant DB

Result  -> 280 transactions, 100% rule coverage, quality score 1.00
"""

import os
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from Ingestion.format_detector  import detect_csv_format, validate_csv_structure, normalize_to_standard
from Ingestion.normalizer        import clean_merchant_name, deduplicate_transactions, validate_date_range, calculate_data_quality_score
from Categorization.rule_categorizer import build_rule_engine, batch_categorize
from Categorization.merchant_db      import lookup_merchant, save_to_cache, update_from_user_correction


CSV_PATH = os.path.join(os.path.dirname(__file__), "Data/wealthsimple_demo.csv")



####################################
# STEP 1: INGEST CSV
####################################

print("\n--- STEP 1: INGEST ---")

format_type = detect_csv_format(CSV_PATH)

df_raw = pd.read_csv(CSV_PATH)
validate_csv_structure(df_raw, format_type)

df = normalize_to_standard(df_raw, format_type)

print(df.head(5).to_string(index=False))



####################################
# STEP 2: CLEAN & VALIDATE
####################################

print("\n--- STEP 2: CLEAN & VALIDATE ---")

df["merchant"] = df["merchant"].apply(clean_merchant_name)
df             = deduplicate_transactions(df)

validate_date_range(df)
quality_score = calculate_data_quality_score(df)



####################################
# STEP 3: RULE CATEGORIZATION
####################################

print("\n--- STEP 3: RULE CATEGORIZATION ---")

rules  = build_rule_engine()
result = batch_categorize(df["merchant"].tolist(), rules)

# merge categories back onto df
df["category"]   = result["category"].values
df["confidence"] = result["confidence"].values

print("\nCategory breakdown:")
print(df["category"].value_counts().to_string())



####################################
# STEP 4: MERCHANT DB — CACHE & LOOKUP
####################################

print("\n--- STEP 4: MERCHANT DB ---")

# simulate saving a few results to cache
save_to_cache("STARBUCKS",    "Dining",         0.95)
save_to_cache("NETFLIX",      "Subscriptions",  0.95)
save_to_cache("MYSTERY SHOP", "Uncategorized",  0.45)

# simulate a user correction for something ambiguous
update_from_user_correction("MYSTERY SHOP", "Shopping")

# lookup a few merchants
for merchant in ["STARBUCKS", "NETFLIX", "MYSTERY SHOP", "UNKNOWN PLACE"]:
    cat, conf, user_verified = lookup_merchant(merchant)
    print(f"  {merchant:20} -> {str(cat):15} (conf={conf:.2f}, user={user_verified})")



####################################
# STEP 5: IDENTIFY LLM FALLBACK CANDIDATES
####################################

print("\n--- STEP 5: LLM FALLBACK CANDIDATES ---")

# anything with no category or confidence < 0.7 needs LLM
needs_llm = df[df["category"].isna() | (df["confidence"] < 0.7)]["merchant"].unique().tolist()

print(f"Merchants needing LLM fallback: {len(needs_llm)}")
if needs_llm:
    for m in needs_llm[:10]:
        print(f"  {m}")
else:
    print("  None — rule engine covered everything")


print("\n--- SUMMARY ---")
print(f"  Total transactions:  {len(df)}")
print(f"  Categorized:         {df['category'].notna().sum()}")
print(f"  Needs LLM:           {len(needs_llm)}")
print(f"  Data quality score:  {quality_score:.2f}")
print(f"  Date range:          {df['date'].min()} → {df['date'].max()}")
print()
