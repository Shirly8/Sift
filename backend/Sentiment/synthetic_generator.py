import csv
import os
import random
import pandas as pd
import ollama


class SyntheticGenerator:
    def __init__(self, model = "llama3:8b"):
        self.model = model
        self.data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')
        self.output_path = os.path.join(self.data_dir, 'synthetic_augmentation.csv')


    # Aspect keywords for generation prompts
    ASPECT_PHRASES = {
        "Service": ["service", "wait times", "staff", "waiter", "waitress", "reservations"],
        "Ambience": ["ambience", "atmosphere", "decor", "noise level", "lighting", "seating"],
        "Price": ["pricing", "cost", "affordability", "value for money"],
        "Food Quality": ["food quality", "freshness", "ingredients", "presentation"],
        "Taste": ["taste", "flavor", "seasoning", "texture"],
        "Menu": ["menu variety", "menu options", "selection of dishes"],
        "Location": ["location", "accessibility", "parking"],
        "Drinks": ["drinks", "cocktails", "wine", "beer", "beverages"],
        "Desserts": ["desserts", "tiramisu", "panna cotta", "cheesecake", "gelato"],
    }

    RATING_DESCRIPTIONS = {
        1: "a terrible, 1-star",
        2: "a disappointing, 2-star",
        3: "an average, 3-star",
        4: "a good, 4-star",
        5: "an excellent, 5-star",
    }



    ####################################
    # STEP 1: ANALYZE GAPS IN REAL DATA
    ####################################

    def find_gaps(self, real_csv_path, min_per_aspect = 30, min_per_rating = 10):
        """Check which aspects/ratings are underrepresented in real data"""

        df = pd.read_csv(real_csv_path)

        # Count reviews per aspect
        aspect_counts = df['aspect'].value_counts().to_dict() if 'aspect' in df.columns else {}

        gaps = []

        for aspect in self.ASPECT_PHRASES.keys():
            count = aspect_counts.get(aspect, 0)

            if count < min_per_aspect:
                needed = min_per_aspect - count
                gaps.append({"aspect": aspect, "needed": needed, "current": count})

        print(f"Found {len(gaps)} underrepresented aspects")
        for g in gaps:
            print(f"  {g['aspect']}: {g['current']} reviews (need {g['needed']} more)")

        return gaps



    ####################################
    # STEP 2: GENERATE A SINGLE REVIEW
    ####################################

    def generate_review(self, aspect, rating):
        """Generate one synthetic review for a specific aspect and rating"""

        phrase = random.choice(self.ASPECT_PHRASES[aspect])
        description = self.RATING_DESCRIPTIONS[rating]

        prompt = (
            f"Write a single-sentence restaurant review that reflects {description} experience, "
            f"focusing on '{phrase}'. Do not mention the star rating. Be natural and realistic."
        )

        try:
            response = ollama.generate(model=self.model, prompt=prompt)
            text = response['response'].strip().strip('"').strip("'")
            return {"review": text, "aspect": aspect, "rating": rating}
        except Exception as e:
            print(f"Generation failed: {e}")
            return None



    ####################################
    # STEP 3: GENERATE BATCH FOR GAPS
    ####################################

    def fill_gaps(self, gaps):
        """Generate reviews to fill underrepresented aspects"""

        all_reviews = []

        for gap in gaps:
            aspect = gap['aspect']
            needed = gap['needed']
            print(f"\nGenerating {needed} reviews for '{aspect}'...")

            for i in range(needed):
                rating = random.randint(1, 5)
                review = self.generate_review(aspect, rating)

                if review:
                    all_reviews.append(review)
                    print(f"  [{i+1}/{needed}] {aspect} | {rating} star")

        return all_reviews



    ####################################
    # STEP 4: GENERATE FREELY (NO GAPS)
    ####################################

    def generate_batch(self, count = 100):
        """Generate N reviews across random aspects and ratings"""

        all_reviews = []

        for i in range(count):
            aspect = random.choice(list(self.ASPECT_PHRASES.keys()))
            rating = random.randint(1, 5)

            review = self.generate_review(aspect, rating)
            if review:
                all_reviews.append(review)
                print(f"[{i+1}/{count}] {aspect} | {rating} star")

        return all_reviews



    ####################################
    # STEP 5: WRITE TO CSV
    ####################################

    def write_csv(self, reviews):
        """Write synthetic reviews to CSV"""

        os.makedirs(self.data_dir, exist_ok=True)

        with open(self.output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["review", "aspect", "rating"])
            writer.writeheader()
            writer.writerows(reviews)

        print(f"\nWrote {len(reviews)} synthetic reviews to {self.output_path}")



    ####################################
    # STEP 6: RUN FULL PIPELINE
    ####################################

    def run(self, real_csv_path = None, count = 100):
        """
        If real_csv_path provided: analyze gaps and fill them
        If not: generate freely
        """

        if real_csv_path and os.path.exists(real_csv_path):
            print("Analyzing gaps in real data...")
            gaps = self.find_gaps(real_csv_path)

            if gaps:
                reviews = self.fill_gaps(gaps)
            else:
                print("No gaps found. Generating general batch instead.")
                reviews = self.generate_batch(count)
        else:
            print("No real data provided. Generating general batch...")
            reviews = self.generate_batch(count)

        self.write_csv(reviews)
        return reviews




if __name__ == "__main__":

    generator = SyntheticGenerator(model="llama3:8b")

    real_data = os.path.join(os.path.dirname(__file__), '..', 'data', 'raw_reviews.csv')

    generator.run(real_csv_path=real_data, count=100)
