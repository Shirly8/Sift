"""
Unit tests for Monte Carlo simulator — projections, stress tests, and runway.

Run: cd backend && python -m pytest tests/test_simulator.py -v
"""

import os
import sys
import pytest
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from Tools.simulator import run_projection, stress_test, calculate_runway


# ─── FIXTURES ───────────────────────────────────────────────

@pytest.fixture
def sample_df():
    """12-month dataset with income, variable spending, and subscriptions."""
    np.random.seed(42)
    dates = pd.date_range("2025-01-01", "2025-12-31", freq="D")
    rows  = []

    for d in dates:
        rows.append({"date": d, "amount": np.random.uniform(20, 80), "merchant": "LOBLAWS", "category": "Groceries"})
        if d.weekday() >= 4:
            rows.append({"date": d, "amount": np.random.uniform(15, 45), "merchant": "STARBUCKS", "category": "Dining"})
        if d.day == 15:
            rows.append({"date": d, "amount": 15.99, "merchant": "NETFLIX", "category": "Subscriptions"})
            rows.append({"date": d, "amount": 11.99, "merchant": "SPOTIFY", "category": "Subscriptions"})
        if d.day == 1:
            rows.append({"date": d, "amount": 3500, "merchant": "EMPLOYER PAYROLL", "category": "Income"})

    return pd.DataFrame(rows)


@pytest.fixture
def no_income_df():
    """Spending only — no income transactions."""
    np.random.seed(42)
    dates = pd.date_range("2025-01-01", "2025-12-31", freq="D")
    rows  = [{"date": d, "amount": np.random.uniform(10, 50), "merchant": "SHOP", "category": "Shopping"} for d in dates]
    return pd.DataFrame(rows)


@pytest.fixture
def short_df():
    """2-week dataset — too short for most tools."""
    dates = pd.date_range("2025-06-01", "2025-06-14", freq="D")
    rows  = [{"date": d, "amount": 25, "merchant": "STORE", "category": "Groceries"} for d in dates]
    return pd.DataFrame(rows)


# ─── PROJECTION TESTS ──────────────────────────────────────

def test_projection_shape(sample_df):
    """Projection returns monthly list with correct month count."""
    result = run_projection(sample_df, months=6)

    assert "error" not in result
    assert len(result["monthly"]) == 6

    for entry in result["monthly"]:
        assert "spend_p10" in entry
        assert "spend_p50" in entry
        assert "spend_p90" in entry
        assert "net_p50" in entry


def test_percentile_ordering(sample_df):
    """p10 <= p50 <= p90 at every month."""
    result = run_projection(sample_df, months=6)

    for entry in result["monthly"]:
        assert entry["spend_p10"] <= entry["spend_p50"]
        assert entry["spend_p50"] <= entry["spend_p90"]


def test_baseline_values(sample_df):
    """Baseline includes income, spending, and fixed cost breakdowns."""
    result = run_projection(sample_df, months=6)

    baseline = result["baseline"]
    assert baseline["monthly_income"] > 0
    assert baseline["monthly_spending"] > 0
    assert baseline["fixed_costs"] >= 0


def test_job_loss_reduces_net(sample_df):
    """Job loss scenario should produce lower net than baseline."""
    baseline = run_projection(sample_df, months=6)
    job_loss = run_projection(sample_df, months=6, scenario={"type": "job_loss"})

    # median net at final month should be worse under job loss
    assert job_loss["monthly"][-1]["net_p50"] < baseline["monthly"][-1]["net_p50"]


def test_short_data_projection(short_df):
    """Short dataset should still produce a projection (not crash)."""
    result = run_projection(short_df, months=3)
    assert "monthly" in result or "error" in result


# ─── STRESS TEST TESTS ─────────────────────────────────────

def test_stress_job_loss_returns_runway(sample_df):
    """Job loss stress test returns months_of_runway and categories_to_cut."""
    result = stress_test(sample_df, "job_loss")

    assert result["scenario"] == "job_loss"
    assert "months_of_runway" in result
    assert "categories_to_cut" in result
    assert isinstance(result["categories_to_cut"], list)


def test_stress_categories_exclude_essentials(sample_df):
    """Categories to cut should never include essential spending."""
    result = stress_test(sample_df, "job_loss")

    essentials = {"groceries", "grocery", "rent & housing", "rent", "mortgage",
                  "healthcare", "medical", "insurance", "utilities",
                  "bills & utilities", "childcare", "education"}

    for cat in result["categories_to_cut"]:
        assert cat["category"].lower() not in essentials


def test_stress_subscription_purge(sample_df):
    """Subscription purge returns savings and compounded amount."""
    result = stress_test(sample_df, "subscription_purge")

    assert result["scenario"] == "subscription_purge"
    assert "monthly_savings" in result
    assert "annual_savings" in result
    assert "compounded_5yr" in result
    assert result["compounded_5yr"] > result["annual_savings"]


def test_stress_invalid_scenario(sample_df):
    """Invalid scenario name returns error dict."""
    result = stress_test(sample_df, "alien_invasion")
    assert "error" in result


# ─── RUNWAY TESTS ──────────────────────────────────────────

def test_runway_with_income(sample_df):
    """With income > spending, runway should be positive."""
    result = calculate_runway(sample_df)

    assert result["monthly_income"] > 0
    assert result["months_of_runway"] is not None
    assert result["months_of_runway"] > 0


def test_runway_no_income(no_income_df):
    """No income → runway should be None (cannot estimate without income)."""
    result = calculate_runway(no_income_df)

    assert result["months_of_runway"] is None
    assert result.get("reason") is not None
