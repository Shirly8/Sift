"""
Financial resilience analysis — runway and job-loss stress test.

  run_financial_resilience(df)
  -> {"stress_test": {"months_of_runway": 8.3, "runway_ci": {...}, ...},
      "runway":      {"months_of_runway": 14.2, "monthly_burn": 3800.0, ...}}
"""

import pandas as pd

from Tools.simulator import stress_test as run_stress_test, calculate_runway


def run_financial_resilience(df: pd.DataFrame) -> dict:
    return {
        "stress_test": run_stress_test(df, "job_loss"),
        "runway":      calculate_runway(df),
    }
