"""
Test LLM fallback categorization

Flow: load pipeline output -> LLM classifies uncategorized merchants
      -> cache results -> flag low-confidence for human review

Result -> final coverage after LLM pass
"""

import os
import sys
import pandas as pd

sys.path.insert(0, os.path.dirname(__file__))

from Ingestion.format_detector        import detect_csv_format, validate_csv_structure, normalize_to_standard
from Ingestion.normalizer              import clean_merchant_name, deduplicate_transactions
from Categorization.rule_categorizer  import build_rule_engine, batch_categorize
from Categorization.merchant_db       import lookup_merchant, save_to_cache
from Categorization.llm_categorizer   import batch_categorize_llm, validate_llm_confidence
from LLM.client                        import initialize_llm_client, get_session_cost


CSV_PATH = os.path.join(os.path.dirname(__file__), "Data/wealthsimple_demo.csv")


####################################
# STEP 1-3: REBUILD PIPELINE STATE
# (same as test_pipeline.py)
####################################

print("\n--- PIPELINE (steps 1-3) ---")

format_type = detect_csv_format(CSV_PATH)
df_raw      = pd.read_csv(CSV_PATH)
validate_csv_structure(df_raw, format_type)
df = normalize_to_standard(df_raw, format_type)

df["merchant"] = df["merchant"].apply(clean_merchant_name)
df             = deduplicate_transactions(df)

rules            = build_rule_engine()
result           = batch_categorize(df["merchant"].tolist(), rules)
df["category"]   = result["category"].values
df["confidence"] = result["confidence"].values

# check merchant cache
for i, row in df[df["category"].isna()].iterrows():
    cat, conf, _ = lookup_merchant(row["merchant"])
    if cat:
        df.at[i, "category"]   = cat
        df.at[i, "confidence"] = conf

before_llm = int(df["category"].notna().sum())
needs_llm  = df[df["category"].isna() | (df["confidence"] < 0.7)]["merchant"].unique().tolist()

print(f"Before LLM: {before_llm}/{len(df)} categorized, {len(needs_llm)} candidates for LLM\n")


####################################
# STEP 4: LLM FALLBACK
####################################

print("--- STEP 4: LLM CATEGORIZATION ---")

initialize_llm_client()

llm_results = batch_categorize_llm(needs_llm)

print("\nLLM Results:")
print(f"{'Merchant':<30} {'Category':<20} {'Conf':>5}  Reasoning")
print("-" * 85)
for _, row in llm_results.iterrows():
    flag = " ← review" if row["confidence"] < 0.7 else ""
    print(f"{row['merchant']:<30} {row['category']:<20} {row['confidence']:>5.2f}  {row['reasoning']}{flag}")


####################################
# STEP 5: MERGE RESULTS + CACHE
####################################

print("\n--- STEP 5: MERGE & CACHE ---")

for _, row in llm_results.iterrows():
    merchant = row["merchant"]
    category = row["category"]
    conf     = float(row["confidence"])

    # update df
    mask = df["merchant"] == merchant
    df.loc[mask, "category"]   = category
    df.loc[mask, "confidence"] = conf

    # cache for future runs (skip Uncategorized)
    if category != "Uncategorized" and conf >= 0.7:
        save_to_cache(merchant, category, conf)
        print(f"  Cached: {merchant} -> {category} ({conf:.2f})")


####################################
# STEP 6: FLAG FOR HUMAN REVIEW
####################################

print("\n--- STEP 6: HUMAN REVIEW QUEUE ---")

needs_review = validate_llm_confidence(llm_results)

if len(needs_review) > 0:
    print("\nThese need manual correction:")
    for _, row in needs_review.iterrows():
        print(f"  {row['merchant']:<30} LLM said: {row['category']:<20} ({row['confidence']:.2f}) — {row['reasoning']}")
else:
    print("  None — all LLM results above confidence threshold")


####################################
# SUMMARY
####################################

after_llm  = int(df["category"].notna().sum())
still_none = df["category"].isna().sum()

print(f"""
--- SUMMARY ---
  Before LLM:   {before_llm}/{len(df)} ({before_llm/len(df):.0%})
  After LLM:    {after_llm}/{len(df)} ({after_llm/len(df):.0%})
  Still unknown:{still_none}
  LLM cost:     ${get_session_cost():.4f}
""")
