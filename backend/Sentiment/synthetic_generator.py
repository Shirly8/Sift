import csv
import os
from datetime import datetime, timedelta
import random
from llm_client import LLMClient


class EvaluationDataGenerator:
    def __init__(self):
        self.llm = LLMClient()
        self.data_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'frontend', 'public', 'data')

    RATING_DESCRIPTIONS = {
        1: "a terrible, 1-star",
        2: "a disappointing, 2-star",
        3: "an average, 3-star",
        4: "a good, 4-star",
        5: "an excellent, 5-star",
    }

    ASPECTS = [
        "Service", "Ambience", "Price", "Food Quality",
        "Taste", "Menu", "Location", "Drinks", "Desserts",
    ]


    def generate_review(self, restaurant_name, cuisine, rating, restaurant_description=None):
        """Generate one synthetic review for a restaurant"""

        rating_description = self.RATING_DESCRIPTIONS[rating]

        prompt = (
            f"Write a realistic restaurant review for '{restaurant_name}', "
            f"a {cuisine} restaurant. The review should reflect {rating_description} dining experience. "
        )

        if restaurant_description:
            prompt += f"The restaurant is described as: {restaurant_description}. "

        prompt += (
            "Include specific dish names or experience details. Be natural and realistic. "
            "Do not mention the star rating explicitly."
        )

        try:
            text = self.llm.generate(prompt)
            return text
        except Exception as e:
            print(f"Generation failed: {e}")
            return None

    def generate_training(self, restaurant_name, cuisine, aspects_ratings, restaurant_description=None):
        """Generate one review covering multiple aspects; returns one row per aspect (same review text)"""

        aspects_desc = ", ".join(
            f"{aspect} ({self.RATING_DESCRIPTIONS[rating]})"
            for aspect, rating in aspects_ratings.items()
        )

        prompt = (
            f"Write a realistic restaurant review for '{restaurant_name}', "
            f"a {cuisine} restaurant. "
            f"The review must naturally mention and evaluate these specific aspects: {aspects_desc}. "
        )

        if restaurant_description:
            prompt += f"The restaurant is described as: {restaurant_description}. "

        prompt += (
            "Make the review feel organic and authentic, not like a structured checklist. "
            "Include specific dish names where relevant. "
            "Do not mention star ratings explicitly."
        )

        try:
            text = self.llm.generate(prompt)
            if text:
                return [
                    {"review": text, "aspect": aspect, "rating": rating}
                    for aspect, rating in aspects_ratings.items()
                ]
            return []
        except Exception as e:
            print(f"Generation failed: {e}")
            return []

    def generate_random_date(self, days_back=30):
        """Generate a random date within the last N days"""
        today = datetime.now()
        random_days = random.randint(0, days_back)
        date = today - timedelta(days=random_days)
        return date.strftime("%m/%d/%Y")


    def generate_batch(self, type, restaurant_name, cuisine, count=10, restaurant_description=None):
        """Generate N reviews for a restaurant with varying ratings"""

        reviews = []

        print(f"Generating {count} {'training rows' if type == 'training' else 'reviews'} for '{restaurant_name}' ({cuisine} cuisine)...\n")

        if type == "evaluation":
            # Distribute reviews evenly across rating spectrum
            ratings = []
            per_rating = count // 5
            remainder = count % 5

            for rating in range(1, 6):
                ratings.extend([rating] * per_rating)
            for i in range(remainder):
                ratings.append(5 - i)

            random.shuffle(ratings)

            for i, rating in enumerate(ratings):
                review_text = self.generate_review(restaurant_name, cuisine, rating, restaurant_description)
                if review_text:
                    reviews.append({
                        "restaurant": restaurant_name,
                        "review": review_text,
                        "rating": rating,
                        "date": self.generate_random_date()
                    })
                    print(f"[{i+1}/{count}] {rating}-star review generated")
                else:
                    print(f"[{i+1}/{count}] Failed to generate review")

        elif type == "training":
            # Each iteration generates one multi-aspect review → multiple labeled rows
            for i in range(count):
                num_aspects = random.randint(2, 3)
                chosen_aspects = random.sample(self.ASPECTS, num_aspects)
                aspects_ratings = {asp: random.randint(1, 5) for asp in chosen_aspects}

                rows = self.generate_training(restaurant_name, cuisine, aspects_ratings, restaurant_description)
                if rows:
                    reviews.extend(rows)
                    print(f"[{i+1}/{count}] Generated {len(rows)} rows — aspects: {list(aspects_ratings.keys())}")
                else:
                    print(f"[{i+1}/{count}] Failed to generate training review")

        return reviews


    def write_csv(self, reviews, output_filename=None, type="evaluation"):
        """Write reviews to CSV — columns depend on mode"""

        os.makedirs(self.data_dir, exist_ok=True)

        if not reviews:
            print("No reviews to write. Check that LLM generation succeeded.")
            return None

        if type == "evaluation":
            # Create restaurant-specific folder
            restaurant_name = reviews[0]['restaurant']
            restaurant_folder = restaurant_name.replace(" ", "_").replace("'", "").replace(",", "")
            restaurant_dir = os.path.join(self.data_dir, restaurant_folder)
            os.makedirs(restaurant_dir, exist_ok=True)

            if output_filename is None:
                output_filename = f"synthetic_{restaurant_folder}.csv"
            fieldnames = ["restaurant", "review", "rating", "date"]
            output_path = os.path.join(restaurant_dir, output_filename)
        else:
            # Training data - just use base data_dir
            if output_filename is None:
                output_filename = "synthetic_training.csv"
            fieldnames = ["review", "aspect", "rating"]
            output_path = os.path.join(self.data_dir, output_filename)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
            writer.writeheader()
            writer.writerows(reviews)

        print(f"\nWrote {len(reviews)} rows to {output_path}")
        return output_path


    def generate_for_restaurant(self, type, restaurant_name, cuisine, count=10, output_filename=None, restaurant_description=None):
        """Main method: generate and save data for a restaurant"""

        reviews = self.generate_batch(type, restaurant_name, cuisine, count, restaurant_description)
        output_path = self.write_csv(reviews, output_filename, type=type)

        return reviews, output_path


if __name__ == "__main__":
    import sys

    # Usage: python synthetic_generator.py <type> <restaurant_name> <cuisine> <count> [description]
    # type: "evaluation" (default) or "training"
    gen_type = sys.argv[1] if len(sys.argv) > 1 else "evaluation"
    restaurant_name = sys.argv[2] if len(sys.argv) > 2 else "Aretti"
    cuisine = sys.argv[3] if len(sys.argv) > 3 else "Italian"
    count = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    description = sys.argv[5] if len(sys.argv) > 5 else None

    generator = EvaluationDataGenerator()
    reviews, output_path = generator.generate_for_restaurant(
        type=gen_type,
        restaurant_name=restaurant_name,
        cuisine=cuisine,
        count=count,
        restaurant_description=description
    )
