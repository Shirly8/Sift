"""
What aspects do restaurants get the most review? 

Input: DataFrame with aspects scored as numeric values (from semantic analyzer) + overall rating
Output:
{
  "Food Quality": 0.32,
  "Service": 0.28,
  "Ambience": 0.18,
  "Taste": 0.12,
  "Price": 0.10
}
"""

import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression

SENTIMENT_SCORE = {"Positive": 2, "Neutral": 1, "Negative": 0}

def compute_impact(df):
    """Regress aspect scores against overall rating → normalized impact %"""

    skip = ['restaurant', 'review', 'overall_rating']
    aspect_cols = [c for c in df.columns if c not in skip]

    #drop rows missing rating or all aspects
    df = df.dropna(subset=['overall_rating'])
    df = df.dropna(subset=aspect_cols, how='all')
    df[aspect_cols] = df[aspect_cols].fillna(1)   #missing aspect → neutral

    X = df[aspect_cols].values
    y = df['overall_rating'].values

    reg = LinearRegression().fit(X, y)

    #normalize abs coefficients to sum to 1
    coefs = np.abs(reg.coef_)
    total = coefs.sum()

    if total == 0:
        return {}

    impact = {}
    for aspect, coef in zip(aspect_cols, coefs):
        impact[aspect] = round(float(coef / total), 4)

    #sort highest to lowest
    impact = dict(sorted(impact.items(), key=lambda x: x[1], reverse=True))
    return impact

if __name__ == "__main__":

    from semantic_analyzer import SemanticAnalyzer

    print("Loading model...")
    analyzer = SemanticAnalyzer()

    # Need multiple reviews for regression to work
    test_reviews = [
        {"review": "The pasta was overcooked and bland, but the waiter was incredibly friendly and the ambience was cozy.", "rating": 4},
        {"review": "Fresh ingredients, amazing flavours, and friendly staff. Highly recommend!", "rating": 5},
        {"review": "Expensive and mediocre food. Service was slow. Wouldn't go back.", "rating": 2},
    ]

    rows = []
    for entry in test_reviews:
        sentiments = analyzer.analyze(entry['review'])
        if sentiments:
            row = {"overall_rating": entry['rating']}
            for aspect, label in sentiments.items():
                row[aspect] = SENTIMENT_SCORE.get(label, 1)
            rows.append(row)

    if rows:
        df = pd.DataFrame(rows)
        impact = compute_impact(df)


        print("Analyzed following reviews: ")

        for entry in test_reviews:
            print(f"  Review: {entry['review']}\n  Rating: {entry['rating']}\n")


        print("\nImpact Attribution Results:")
        for aspect, pct in impact.items():
            print(f"  {aspect}: {pct*100:.1f}%")
    