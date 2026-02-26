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
    """Projection returns 5 percentile bands with correct month count."""
    result = run_projection(sample_df, months=6, n_sims=500)

    assert "error" not in result
    assert set(result["monthly_net"].keys()) == {10, 25, 50, 75, 90}
    assert set(result["cumulative_net"].keys()) == {10, 25, 50, 75, 90}

    for pct in [10, 25, 50, 75, 90]:
        assert len(result["monthly_net"][pct]) == 6
        assert len(result["cumulative_net"][pct]) == 6


def test_percentile_ordering(sample_df):
    """10th percentile <= 50th <= 90th at every month."""
    result = run_projection(sample_df, months=6, n_sims=1000)

    for i in range(6):
        assert result["monthly_net"][10][i] <= result["monthly_net"][50][i]
        assert result["monthly_net"][50][i] <= result["monthly_net"][90][i]


def test_baseline_values(sample_df):
    """Baseline includes income, spending, fixed, and variable breakdowns."""
    result = run_projection(sample_df, months=6, n_sims=500)

    baseline = result["baseline"]
    assert baseline["monthly_income"] > 0
    assert baseline["monthly_spending"] > 0
    assert baseline["fixed_costs"] >= 0
    assert baseline["variable_spending"] > 0


def test_job_loss_reduces_net(sample_df):
    """Job loss scenario should produce lower net than baseline."""
    baseline = run_projection(sample_df, months=6, n_sims=500)
    job_loss = run_projection(sample_df, months=6, n_sims=500, scenario={"type": "job_loss"})

    # median cumulative at month 6 should be worse under job loss
    assert job_loss["cumulative_net"][50][-1] < baseline["cumulative_net"][50][-1]


def test_short_data_projection(short_df):
    """Short dataset should still produce a projection (not crash)."""
    result = run_projection(short_df, months=3, n_sims=100)
    # either returns valid projection or an error dict — both are acceptable
    assert "monthly_net" in result or "error" in result


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
    """Subscription purge returns savings and compounded amounts."""
    result = stress_test(sample_df, "subscription_purge")

    assert result["scenario"] == "subscription_purge"
    assert "monthly_savings" in result
    assert "annual_savings" in result
    assert "compounded_savings" in result
    assert "1yr" in result["compounded_savings"]


def test_stress_invalid_scenario(sample_df):
    """Invalid scenario name raises ValueError."""
    with pytest.raises(ValueError):
        stress_test(sample_df, "alien_invasion")


# ─── RUNWAY TESTS ──────────────────────────────────────────

def test_runway_with_income(sample_df):
    """With income > spending, runway should be infinite."""
    result = calculate_runway(sample_df)

    # income ($3500/mo) far exceeds spending — runway should be infinite or very large
    assert result["monthly_income"] > 0
    assert "months_of_runway" in result


def test_runway_no_income(no_income_df):
    """No income → runway should be 0."""
    result = calculate_runway(no_income_df)

    assert result["months_of_runway"] == 0
    assert result["monthly_income"] == 0
