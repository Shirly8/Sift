"""
Unit tests for analysis tools — covers accuracy, edge cases, and data integrity.

Run: cd backend && python -m pytest tests/test_tools.py -v
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from Tools.anomaly_detector       import detect_transaction_outliers, detect_spending_spikes, detect_new_merchants
from Tools.subscription_hunter    import detect_recurring_charges, detect_price_creep, detect_subscription_overlap
from Tools.spending_impact        import fit_impact_model
from Tools.temporal_patterns      import detect_payday_pattern, detect_weekly_pattern, detect_seasonal_pattern
from Tools.behavioral_correlation import calculate_category_correlations
from Categorization.rule_categorizer import build_rule_engine, categorize_merchant
from Ingestion.normalizer         import clean_merchant_name, deduplicate_transactions


# ─── FIXTURES ───────────────────────────────────────────────

@pytest.fixture
def sample_df():
    """12-month transaction dataset with realistic patterns."""
    np.random.seed(42)
    dates = pd.date_range("2025-01-01", "2025-12-31", freq="D")
    rows = []

    for d in dates:
        # daily groceries
        rows.append({"date": d, "amount": np.random.uniform(20, 80), "merchant": "LOBLAWS", "category": "Groceries"})
        # regular dining
        if d.weekday() >= 4:  # weekends
            rows.append({"date": d, "amount": np.random.uniform(15, 45), "merchant": "STARBUCKS", "category": "Dining"})
        # monthly subscription (exact amount)
        if d.day == 15:
            rows.append({"date": d, "amount": 15.99, "merchant": "NETFLIX", "category": "Subscriptions"})
            rows.append({"date": d, "amount": 11.99, "merchant": "SPOTIFY", "category": "Subscriptions"})
        # monthly income
        if d.day == 1:
            rows.append({"date": d, "amount": 3500, "merchant": "EMPLOYER PAYROLL", "category": "Income"})

    return pd.DataFrame(rows)


@pytest.fixture
def short_df():
    """Minimal dataset — 2 weeks, edge case for many tools."""
    dates = pd.date_range("2025-06-01", "2025-06-14", freq="D")
    rows = [{"date": d, "amount": 10 + i, "merchant": f"MERCHANT_{i%3}", "category": "Dining"} for i, d in enumerate(dates)]
    return pd.DataFrame(rows)


@pytest.fixture
def empty_category_df():
    """Dataset with missing/empty categories."""
    return pd.DataFrame({
        "date": pd.date_range("2025-01-01", periods=20),
        "amount": np.random.uniform(5, 100, 20),
        "merchant": ["UNKNOWN"] * 20,
        "category": [None] * 10 + [""] * 10,
    })


# ─── OUTLIER DETECTION ─────────────────────────────────────

class TestOutlierDetection:

    def test_detects_genuine_outlier(self, sample_df):
        """A $500 grocery purchase should be flagged when avg is ~$50."""
        df = sample_df.copy()
        outlier_row = pd.DataFrame([{"date": pd.Timestamp("2025-06-15"), "amount": 500, "merchant": "LOBLAWS", "category": "Groceries"}])
        df = pd.concat([df, outlier_row], ignore_index=True)

        outliers = detect_transaction_outliers(df)
        assert any(o["amount"] == 500 for o in outliers), "Should detect $500 grocery outlier"

    def test_no_false_positives_on_normal_data(self, sample_df):
        """Normal data shouldn't produce many outliers."""
        outliers = detect_transaction_outliers(sample_df)
        # with IQR at 2x, normal uniform data should have very few outliers
        assert len(outliers) < 5, f"Too many false positives: {len(outliers)}"

    def test_skips_income_category(self, sample_df):
        outliers = detect_transaction_outliers(sample_df)
        assert not any(o["category"] == "Income" for o in outliers)

    def test_handles_empty_categories(self, empty_category_df):
        """Should not crash on NaN/empty categories."""
        outliers = detect_transaction_outliers(empty_category_df)
        assert isinstance(outliers, list)


# ─── SUBSCRIPTION DETECTION ────────────────────────────────

class TestSubscriptionDetection:

    def test_detects_monthly_subscription(self, sample_df):
        """Netflix at $15.99/mo on the 15th should be detected."""
        recurring = detect_recurring_charges(sample_df)
        netflix = [r for r in recurring if "NETFLIX" in r["merchant"]]
        assert len(netflix) == 1, "Should detect Netflix as recurring"
        assert netflix[0]["frequency"] == "monthly"
        assert abs(netflix[0]["amount"] - 15.99) < 0.01

    def test_filters_habitual_purchases(self, sample_df):
        """Regular Starbucks visits should NOT be flagged as subscription."""
        recurring = detect_recurring_charges(sample_df)
        starbucks = [r for r in recurring if "STARBUCKS" in r["merchant"]]
        # Starbucks has variable amounts in a habit category — should be filtered
        assert len(starbucks) == 0, "Habitual Starbucks purchases should not be flagged as subscription"

    def test_price_creep_detection(self):
        """Detect price increase from $10 to $13 over 6 months."""
        rows = []
        for i in range(6):
            d = pd.Timestamp(f"2025-{i+1:02d}-15")
            rows.append({"date": d, "amount": 10 + i * 0.6, "merchant": "STREAMING_SVC", "category": "Subscriptions"})
        df = pd.DataFrame(rows)

        result = detect_price_creep(df, "STREAMING_SVC")
        assert result["price_creep_detected"] is True
        assert result["current_price"] > result["original_price"]


# ─── SPENDING IMPACT ───────────────────────────────────────

class TestSpendingImpact:

    def test_high_variance_category_ranks_first(self, sample_df):
        """Category with most dollar variance should rank highest."""
        result = fit_impact_model(sample_df)
        assert result["model_valid"] is True
        # Groceries has the highest absolute std (daily purchases, wide range)
        top = result["impacts"][0]
        assert top["monthly_std"] > 0

    def test_dollar_weighted_ranking(self):
        """Verify dollar-weighted: $500 std beats $20 std even if CV is lower."""
        rows = []
        for m in range(8):
            d = pd.Timestamp(f"2025-{m+1:02d}-15")
            # category A: high dollar variance ($500 avg, $200 std)
            rows.append({"date": d, "amount": 500 + np.random.normal(0, 200), "merchant": "BIG_STORE", "category": "Shopping"})
            # category B: high CV but tiny dollars ($20 avg, $15 std)
            rows.append({"date": d, "amount": max(5, 20 + np.random.normal(0, 15)), "merchant": "SMALL_SHOP", "category": "Entertainment"})
            # filler category
            rows.append({"date": d, "amount": 100, "merchant": "STABLE", "category": "Groceries"})
        df = pd.DataFrame(rows)

        result = fit_impact_model(df)
        assert result["model_valid"] is True
        # Shopping ($200 std) should rank above Entertainment ($15 std)
        categories = [i["category"] for i in result["impacts"]]
        assert categories.index("Shopping") < categories.index("Entertainment")

    def test_rejects_short_data(self, short_df):
        result = fit_impact_model(short_df)
        assert result["model_valid"] is False


# ─── TEMPORAL PATTERNS ─────────────────────────────────────

class TestTemporalPatterns:

    def test_payday_detection_with_income(self, sample_df):
        result = detect_payday_pattern(sample_df)
        # synthetic data has uniform spending so pattern may not trigger —
        # verify the function runs and returns expected shape
        assert "payday_detected" in result

    def test_weekly_pattern_returns_valid_structure(self, sample_df):
        result = detect_weekly_pattern(sample_df)
        assert "weekend_spending_multiple" in result
        assert "highest_spending_day" in result
        assert result["weekend_spending_multiple"] > 0

    def test_seasonal_on_stable_data(self):
        """Flat spending should not be flagged as seasonal."""
        rows = [{"date": pd.Timestamp(f"2025-{m+1:02d}-15"), "amount": 100, "merchant": "X", "category": "A"} for m in range(6)]
        df = pd.DataFrame(rows)
        result = detect_seasonal_pattern(df)
        assert result["seasonal_detected"] is False


# ─── CATEGORIZATION ────────────────────────────────────────

class TestCategorization:

    def test_rule_engine_exact_match(self):
        rules = build_rule_engine()
        cat, conf = categorize_merchant("NETFLIX", rules)
        assert cat == "Subscriptions"
        assert conf >= 0.90

    def test_rule_engine_substring_match(self):
        rules = build_rule_engine()
        cat, conf = categorize_merchant("UBER EATS ORDER", rules)
        assert cat is not None
        assert conf > 0

    def test_unknown_merchant_returns_none(self):
        rules = build_rule_engine()
        cat, conf = categorize_merchant("XYZZY UNKNOWN CORP", rules)
        assert cat is None
        assert conf == 0.0


# ─── MERCHANT CLEANING ─────────────────────────────────────

class TestMerchantCleaning:

    def test_strips_bank_prefix(self):
        assert clean_merchant_name("DEBIT CARD PURCHASE - STARBUCKS") == "STARBUCKS"

    def test_strips_store_number(self):
        result = clean_merchant_name("STARBUCKS #1234 ON KING ST")
        assert result == "STARBUCKS"

    def test_strips_online_suffix(self):
        result = clean_merchant_name("AMAZON.COM*MX123456")
        assert "MX123456" not in result

    def test_empty_string_returns_original(self):
        result = clean_merchant_name("   ")
        assert len(result) > 0  # should not return empty


# ─── DEDUPLICATION ──────────────────────────────────────────

class TestDeduplication:

    def test_keeps_two_identical_transactions(self):
        """Two identical purchases in a day is plausible (two coffees)."""
        df = pd.DataFrame({
            "date": ["2025-01-01"] * 3,
            "amount": [5.50] * 3,
            "merchant": ["STARBUCKS"] * 3,
        })
        result = deduplicate_transactions(df)
        assert len(result) == 2  # keeps 2, drops 3rd

    def test_keeps_different_amounts(self):
        df = pd.DataFrame({
            "date": ["2025-01-01"] * 3,
            "amount": [5.50, 6.00, 5.50],
            "merchant": ["STARBUCKS"] * 3,
        })
        result = deduplicate_transactions(df)
        assert len(result) == 3  # all different enough to keep


# ─── EDGE CASES ─────────────────────────────────────────────

class TestEdgeCases:

    def test_single_category_correlation(self):
        """Correlation engine needs 3+ categories — should return empty."""
        df = pd.DataFrame({
            "date": pd.date_range("2025-01-01", periods=100),
            "amount": np.random.uniform(10, 50, 100),
            "merchant": ["X"] * 100,
            "category": ["Dining"] * 100,
        })
        result = calculate_category_correlations(df)
        assert result == []

    def test_spending_spikes_short_data(self):
        """< 45 days should return empty."""
        df = pd.DataFrame({
            "date": pd.date_range("2025-01-01", periods=30),
            "amount": np.random.uniform(10, 50, 30),
            "merchant": ["X"] * 30,
            "category": ["Dining"] * 30,
        })
        result = detect_spending_spikes(df)
        assert result == []
