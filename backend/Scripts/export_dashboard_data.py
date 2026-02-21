import os
import sys
import json
import pandas as pd
from collections import defaultdict
from datetime import datetime


DATA_DIR   = os.path.join(os.path.dirname(__file__), '../Data')
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '../../frontend/public/data')

#add backend modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../Sentiment'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../Evaluator'))

from semantic_analyzer import SemanticAnalyzer
import impact_attribution
from impact_attribution import SENTIMENT_SCORE
import evaluator


RRESTAURANTS = {
    "360 The Restaurant": "360.csv",
    "Lavelle": "Lavelle.csv",
    "McDonald's": "McDonalds.csv",
    "Pai": "Pai.csv"
}
RESTAURANTS = list(RRESTAURANTS.values())



####################################
# STEP 1: SCORE ALL REVIEWS
####################################

def score_reviews(analyzer):

    all_reviews = []

    for csv_file in RESTAURANTS:
        path = os.path.join(DATA_DIR, csv_file)
        df   = pd.read_csv(path)

        print(f"Scoring {csv_file}...")

        for _, row in df.iterrows():
            review     = str(row['review'])
            sentiments = analyzer.analyze(review)

            if not sentiments:
                continue

            all_reviews.append({
                "restaurant": row['restaurant'],
                "review":     review,
                "rating":     int(row['rating']),
                "date":       str(row['date']),
                "aspects":    sentiments
            })

        print(f"  → {len(df)} reviews done")

    return all_reviews



####################################
# STEP 1b: BUILD SCORED DF FOR IMPACT ATTRIBUTION
####################################

def _build_scored_df_for_impact(reviews):
    """Convert sentiment labels to numeric scores for regression"""

    rows = []
    for entry in reviews:
        row = {
            "restaurant": entry['restaurant'],
            "overall_rating": entry['rating'],
        }

        for aspect, label in entry['aspects'].items():
            row[aspect] = SENTIMENT_SCORE.get(label, 1)

        rows.append(row)

    return pd.DataFrame(rows)


####################################
# STEP 2: BUILD ASPECT SENTIMENTS
####################################

def build_aspect_sentiments(reviews):
    #restaurant → aspect → label counts + avg

    data = defaultdict(lambda: defaultdict(lambda: {"Positive": 0, "Neutral": 0, "Negative": 0, "total": 0, "score_sum": 0}))

    for entry in reviews:
        restaurant = entry['restaurant']
        for aspect, label in entry['aspects'].items():
            data[restaurant][aspect][label]      += 1
            data[restaurant][aspect]['total']    += 1
            data[restaurant][aspect]['score_sum'] += SENTIMENT_SCORE.get(label, 1)

    #compute avg, drop score_sum
    result = {}
    for restaurant, aspects in data.items():
        result[restaurant] = {}
        for aspect, counts in aspects.items():
            avg = round(counts['score_sum'] / counts['total'], 2) if counts['total'] > 0 else 1.0
            result[restaurant][aspect] = {
                "Positive": counts['Positive'],
                "Neutral":  counts['Neutral'],
                "Negative": counts['Negative'],
                "total":    counts['total'],
                "avg":      avg
            }

    return result



####################################
# STEP 3: BUILD ASPECT TRENDS
####################################

def build_aspect_trends(reviews):
    #restaurant → month → aspect → avg score

    raw = defaultdict(lambda: defaultdict(lambda: defaultdict(list)))

    for entry in reviews:
        try:
            month = datetime.strptime(entry['date'], "%m/%d/%Y").strftime("%Y-%m")
        except:
            continue

        restaurant = entry['restaurant']
        for aspect, label in entry['aspects'].items():
            raw[restaurant][month][aspect].append(SENTIMENT_SCORE.get(label, 1))

    #average per month
    result = {}
    for restaurant, months in raw.items():
        result[restaurant] = {}
        for month, aspects in sorted(months.items()):
            result[restaurant][month] = {
                aspect: round(sum(scores) / len(scores), 2)
                for aspect, scores in aspects.items()
            }

    return result



####################################
# STEP 4: SAVE JSON
####################################

def save(filename, data):
    path = os.path.join(OUTPUT_DIR, filename)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        json.dump(data, f, indent=2)
    print(f"Saved → {filename}")



####################################
# MAIN: RUN FULL PIPELINE
####################################

def run():

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Loading model...")
    analyzer = SemanticAnalyzer()

    #score all reviews
    reviews = score_reviews(analyzer)
    print(f"Total scored: {len(reviews)}\n")

    # Save per-restaurant files
    aspect_sentiments = build_aspect_sentiments(reviews)
    aspect_trends = build_aspect_trends(reviews)

    for restaurant in aspect_sentiments:
        folder = os.path.join(OUTPUT_DIR, restaurant.replace(" ", "_").replace("'", "").replace(",", ""))
        os.makedirs(folder, exist_ok=True)
        save(os.path.join(restaurant.replace(" ", "_").replace("'", "").replace(",", ""), "aspect_sentiments.json"), aspect_sentiments[restaurant])
        if restaurant in aspect_trends:
            save(os.path.join(restaurant.replace(" ", "_").replace("'", "").replace(",", ""), "aspect_trends.json"), aspect_trends[restaurant])
        # Save reviews for this restaurant
        restaurant_reviews = [r for r in reviews if r['restaurant'] == restaurant]
        save(os.path.join(restaurant.replace(" ", "_").replace("'", "").replace(",", ""), "review_data.json"), restaurant_reviews)

    # Save global files

    #impact attribution
    print("\nRunning impact attribution...")
    scored_df = _build_scored_df_for_impact(reviews)
    impact = impact_attribution.compute_impact(scored_df)
    print("Impact Attribution Results:")
    for aspect, pct in impact.items():
        print(f"  {aspect}: {pct*100:.1f}%")
    save("impact_attribution.json", impact)

    #evaluation
    print("\nRunning evaluation...")
    evaluator.run(analyzer)

    print("\nAll done → frontend/public/data/")



if __name__ == "__main__":
    run()
