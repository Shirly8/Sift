import os
import json
import pandas as pd
from sklearn.metrics import accuracy_score, precision_recall_fscore_support


CSV_PATH = os.path.join(os.path.dirname(__file__), '../Data/Training/absa_training.csv')
OUTPUT   = os.path.join(os.path.dirname(__file__), '../../frontend/public/data/evaluation_results.json')
SENTIMENT_DIR = os.path.join(os.path.dirname(__file__), '../Sentiment')

#rating → sentiment label
def rating_to_label(rating):
    if rating <= 2: return "Negative"
    if rating == 3: return "Neutral"
    return "Positive"

LABEL_TO_INT = {"Negative": 0, "Neutral": 1, "Positive": 2}



####################################
# STEP 1: LOAD DATA
####################################

def load_data(csv_path):

    df = pd.read_csv(csv_path, index_col=False)
    df = df.dropna(subset=['review', 'aspect', 'rating'])
    df['true_label'] = df['rating'].astype(int).apply(rating_to_label)

    return df



####################################
# STEP 2: RUN ANALYZER
####################################

def run_evaluation(analyzer, df):

    y_true         = []
    y_pred         = []
    missed         = 0
    aspect_results = {}   #{aspect: {true: [], pred: []}}
    total          = len(df)

    for i, (_, row) in enumerate(df.iterrows()):

        if i % 100 == 0:
            print(f"  {i}/{total} reviews processed...")

        review     = str(row['review'])
        aspect     = str(row['aspect'])
        true_label = row['true_label']

        #run full pipeline
        sentiments = analyzer.analyze(review)

        #check if labeled aspect was discovered
        matched = False
        for pred_aspect, pred_label in sentiments.items():
            if aspect.lower() in pred_aspect.lower() or pred_aspect.lower() in aspect.lower():

                y_true.append(LABEL_TO_INT[true_label])
                y_pred.append(LABEL_TO_INT[pred_label])

                #per-aspect tracking
                if aspect not in aspect_results:
                    aspect_results[aspect] = {"true": [], "pred": []}
                aspect_results[aspect]["true"].append(LABEL_TO_INT[true_label])
                aspect_results[aspect]["pred"].append(LABEL_TO_INT[pred_label])

                matched = True
                break

        if not matched:
            missed += 1

    return y_true, y_pred, missed, aspect_results



####################################
# STEP 3: COMPUTE METRICS
####################################

def compute_metrics(y_true, y_pred):

    acc           = accuracy_score(y_true, y_pred)
    p, r, f1, _  = precision_recall_fscore_support(y_true, y_pred, average='weighted', zero_division=0)

    return round(acc, 4), round(float(p), 4), round(float(r), 4), round(float(f1), 4)


def compute_per_aspect(aspect_results):

    breakdown = {}
    for aspect, data in aspect_results.items():
        acc, p, r, f1 = compute_metrics(data['true'], data['pred'])
        breakdown[aspect] = {
            "accuracy":  acc,
            "precision": p,
            "recall":    r,
            "f1":        f1,
            "total":     len(data['true'])
        }

    #sort by f1 descending
    breakdown = dict(sorted(breakdown.items(), key=lambda x: x[1]['f1'], reverse=True))
    return breakdown



####################################
# STEP 4: SAVE OUTPUT
####################################

def run(analyzer, csv_path=CSV_PATH):

    print("Loading evaluation data...")
    df = load_data(csv_path)
    print(f"Loaded {len(df)} labeled reviews\n")

    print("Running analyzer...")
    y_true, y_pred, missed, aspect_results = run_evaluation(analyzer, df)

    total             = len(df)
    evaluated         = len(y_true)
    discovery_recall  = round(evaluated / total, 4) if total > 0 else 0

    print(f"\nTotal: {total} | Evaluated: {evaluated} | Missed: {missed}")
    print(f"Aspect Discovery Recall: {discovery_recall*100:.1f}%\n")

    acc, p, r, f1 = compute_metrics(y_true, y_pred)
    per_aspect    = compute_per_aspect(aspect_results)

    print(f"Accuracy:  {acc*100:.1f}%")
    print(f"Precision: {p:.3f}")
    print(f"Recall:    {r:.3f}")
    print(f"F1:        {f1:.3f}")

    print("\nPer-Aspect F1:")
    for aspect, m in per_aspect.items():
        print(f"  {aspect}: {m['f1']:.3f}  (n={m['total']})")

    results = {
        "accuracy":                acc,
        "precision":               p,
        "recall":                  r,
        "f1":                      f1,
        "aspect_discovery_recall": discovery_recall,
        "total_reviews":           total,
        "evaluated":               evaluated,
        "missed":                  missed,
        "per_aspect":              per_aspect
    }

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w') as f:
        json.dump(results, f, indent=2)

    print(f"\nSaved → {OUTPUT}")
    return results



if __name__ == "__main__":

    import sys
    sys.path.append(SENTIMENT_DIR)
    from semantic_analyzer import SemanticAnalyzer

    analyzer = SemanticAnalyzer()
    run(analyzer)
