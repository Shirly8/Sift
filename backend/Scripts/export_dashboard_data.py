import os
import sys
import json
import pandas as pd
import numpy as np
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





####################################
# STEP 1: SCORE ALL REVIEWS
####################################

def score_reviews(analyzer, restaurants):

    all_reviews = []

    for csv_file in restaurants:
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
# STEP 4: BUILD PAIR DISTRIBUTION
####################################

def build_pair_distribution(reviews):
    """Compute pairwise Pearson correlation between aspect sentiment scores per restaurant"""

    # restaurant → aspect → list of numeric scores per review
    raw = defaultdict(lambda: defaultdict(list))

    for entry in reviews:
        restaurant = entry['restaurant']
        for aspect, label in entry['aspects'].items():
            raw[restaurant][aspect].append(SENTIMENT_SCORE.get(label, 1))

    result = {}
    for restaurant, aspect_scores in raw.items():
        aspects = list(aspect_scores.keys())
        result[restaurant] = {}

        for a in aspects:
            result[restaurant][a] = {}
            for b in aspects:
                if a == b:
                    result[restaurant][a][b] = 1.0
                    continue

                # Pair scores from reviews where both aspects appear
                pairs_a, pairs_b = [], []
                for entry in reviews:
                    if entry['restaurant'] != restaurant:
                        continue
                    if a in entry['aspects'] and b in entry['aspects']:
                        pairs_a.append(SENTIMENT_SCORE.get(entry['aspects'][a], 1))
                        pairs_b.append(SENTIMENT_SCORE.get(entry['aspects'][b], 1))

                if len(pairs_a) < 2:
                    result[restaurant][a][b] = 0.0
                else:
                    corr = np.corrcoef(pairs_a, pairs_b)[0, 1]
                    result[restaurant][a][b] = round(float(max(0, corr)), 2)

    return result


####################################
# STEP 5: SAVE JSON
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

def run(restaurants):

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("Loading model...")
    analyzer = SemanticAnalyzer()

    #score all reviews
    reviews = score_reviews(analyzer, restaurants)
    print(f"Total scored: {len(reviews)}\n")

    # Save per-restaurant files
    aspect_sentiments = build_aspect_sentiments(reviews)
    aspect_trends = build_aspect_trends(reviews)
    pair_distribution = build_pair_distribution(reviews)

    for restaurant in aspect_sentiments:
        folder_name = restaurant.replace(" ", "_").replace("'", "").replace(",", "")
        os.makedirs(os.path.join(OUTPUT_DIR, folder_name), exist_ok=True)
        save(os.path.join(folder_name, "aspect_sentiments.json"), aspect_sentiments[restaurant])
        if restaurant in aspect_trends:
            save(os.path.join(folder_name, "aspect_trends.json"), aspect_trends[restaurant])
        if restaurant in pair_distribution:
            save(os.path.join(folder_name, "pair_distribution.json"), pair_distribution[restaurant])
        # Save reviews for this restaurant
        restaurant_reviews = [r for r in reviews if r['restaurant'] == restaurant]
        save(os.path.join(folder_name, "review_data.json"), restaurant_reviews)

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
    import sys

    if len(sys.argv) > 1:
        # Process specific files passed as arguments
        restaurants = sys.argv[1:]
    else:
        # Default to built-in restaurants
        restaurants = ["360.csv", "Lavelle.csv", "McDonalds.csv", "Pai.csv"]

    run(restaurants)
