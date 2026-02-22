"""
Model test -> Input a review, and determine the aspect identified and the sentiment

Review: The pasta was overcooked and bland, but the waiter was incredibly friendly and the ambience was cozy.
Result: {'Service': 'Positive', 'Ambience': 'Positive', 'Taste': 'Negative', 'Food Quality': 'Negative'}
"""




import os
import sys
import torch
from sentence_transformers import SentenceTransformer, util
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from ModelManager import ModelManager

model_manager = ModelManager()

LABELS = {0: "Negative", 1: "Neutral", 2: "Positive"}

#seed aspects for discovery
ASPECTS = ["Service", "Ambience", "Price", "Food Quality", "Taste", "Menu", "Location", "Drinks", "Desserts"]

#keywords for fast matching
ASPECT_KEYWORDS = {
    "Service":      ["service", "wait", "staff", "waiter", "waitress", "server", "host"],
    "Ambience":     ["ambience", "atmosphere", "decor", "noise", "lighting", "vibe", "seating"],
    "Price":        ["price", "expensive", "cheap", "affordable", "value", "cost", "overpriced"],
    "Food Quality": ["food quality", "fresh", "freshness", "ingredients", "presentation", "quality"],
    "Taste":        ["taste", "flavor", "flavour", "seasoning", "texture", "delicious", "bland"],
    "Menu":         ["menu", "options", "selection", "variety", "dishes"],
    "Location":     ["location", "parking", "accessible", "area", "neighborhood", "distance"],
    "Drinks":       ["drinks", "cocktails", "wine", "beer", "beverages", "coffee", "cocktail"],
    "Desserts":     ["desserts", "tiramisu", "cheesecake", "gelato", "cake", "dessert"],
}



####################################
# STEP 1: LOAD MODELS
####################################

class SemanticAnalyzer:

    def __init__(self, model_dir=None):
        # Use ModelManager to get the active model
        if model_dir is None:
            model_path, model_name = model_manager.get_active_model()
            print(f"Loading model: {model_name}")
        else:
            model_path = model_dir

        #load trained ABSA model
        self.tokenizer = AutoTokenizer.from_pretrained(model_path)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.model.eval()

        #load sentence transformer for semantic similarity
        self.st = SentenceTransformer('all-MiniLM-L6-v2')

        #pre-compute aspect embeddings once
        self.aspect_embeddings = self.st.encode(ASPECTS, convert_to_tensor=True)



    ####################################
    # STEP 2: ASPECT DISCOVERY
    ####################################

    def _keyword_match(self, review):
        """Check which aspects have keywords in the review"""

        text = review.lower()
        matched = []

        for aspect, keywords in ASPECT_KEYWORDS.items():
            if any(kw in text for kw in keywords):
                matched.append(aspect)

        return matched


    def _semantic_match(self, review, threshold=0.25, top_k=3):
        """Get top aspects by cosine similarity"""

        review_emb = self.st.encode(review, convert_to_tensor=True)
        sims = util.cos_sim(review_emb, self.aspect_embeddings)[0]

        candidates = []
        for i, aspect in enumerate(ASPECTS):
            if sims[i].item() > threshold:
                candidates.append((aspect, sims[i].item()))

        #sort by similarity, return top_k
        candidates = sorted(candidates, key=lambda x: x[1], reverse=True)
        return [a for a, _ in candidates[:top_k]]


    def discover_aspects(self, review):
        """Hybrid: keyword matches always included, semantic fills the rest"""

        keyword = self._keyword_match(review)
        semantic = self._semantic_match(review)

        aspects = list(keyword)
        for a in semantic:
            if a not in aspects:
                aspects.append(a)

        return aspects



    ####################################
    # STEP 3: SENTIMENT SCORING
    ####################################

    def _score_aspect(self, review, aspect):
        """Run ABSA model on (review, aspect) → sentiment label"""

        inputs = self.tokenizer(
            review,
            aspect,
            max_length=128,
            truncation=True,
            padding='max_length',
            return_tensors='pt'
        )

        with torch.no_grad():
            logits = self.model(**inputs).logits

        pred = torch.argmax(logits, dim=1).item()
        return LABELS[pred]


    def analyze(self, review):
        """Full pipeline: discover aspects → score each → return dict"""

        aspects = self.discover_aspects(review)

        if not aspects:
            return {}

        results = {}
        for aspect in aspects:
            results[aspect] = self._score_aspect(review, aspect)

        return results



if __name__ == "__main__":

    analyzer = SemanticAnalyzer()

    test_reviews = [
        "The pasta was overcooked and bland, but the waiter was incredibly friendly and the ambience was cozy.",
        "Fresh ingredients, amazing flavours, and friendly staff. Highly recommend!",
        "Expensive and mediocre food. Service was slow. Wouldn't go back."
    ]

    for entry in test_reviews:
        print(f"\n\nReview: {entry}")
        print(analyzer.analyze(entry))
