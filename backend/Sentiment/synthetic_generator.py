import csv
import os
from datetime import datetime, timedelta
import random
from llm_client import LLMClient


class EvaluationDataGenerator:
    def __init__(self):
        self.llm = LLMClient()
        self.data_dir = os.path.join(os.path.dirname(__file__), '..', 'data')

    RATING_DESCRIPTIONS = {
        1: "a terrible, 1-star",
        2: "a disappointing, 2-star",
        3: "an average, 3-star",
        4: "a good, 4-star",
        5: "an excellent, 5-star",
    }


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


    def generate_random_date(self, days_back=30):
        """Generate a random date within the last N days"""
        today = datetime.now()
        random_days = random.randint(0, days_back)
        date = today - timedelta(days=random_days)
        return date.strftime("%m/%d/%Y")


    def generate_batch(self, restaurant_name, cuisine, count=10, restaurant_description=None):
        """Generate N reviews for a restaurant with varying ratings"""

        reviews = []

        # Distribute reviews across rating spectrum
        ratings = []
        per_rating = count // 5
        remainder = count % 5

        for rating in range(1, 6):
            ratings.extend([rating] * per_rating)

        # Add remainder to higher ratings
        for i in range(remainder):
            ratings.append(5 - i)

        random.shuffle(ratings)

        print(f"Generating {count} reviews for '{restaurant_name}' ({cuisine} cuisine)...\n")

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

        return reviews


    def write_csv(self, reviews, output_filename=None):
        """Write evaluation reviews to CSV"""

        os.makedirs(self.data_dir, exist_ok=True)

        if not reviews:
            print("No reviews to write. Check that LLM generation succeeded.")
            return None

        if output_filename is None:
            output_filename = f"synthetic_{reviews[0]['restaurant'].lower()}.csv"

        output_path = os.path.join(self.data_dir, output_filename)

        with open(output_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=["restaurant", "review", "rating", "date"])
            writer.writeheader()
            writer.writerows(reviews)

        print(f"\nWrote {len(reviews)} synthetic reviews to {output_path}")
        return output_path


    def generate_for_restaurant(self, restaurant_name, cuisine, count=10, output_filename=None, restaurant_description=None):
        """Main method: generate and save evaluation data for a restaurant"""

        reviews = self.generate_batch(restaurant_name, cuisine, count, restaurant_description)
        output_path = self.write_csv(reviews, output_filename)

        return reviews, output_path


if __name__ == "__main__":
    import sys

    # Parse command-line arguments
    # Usage: python synthetic_generator.py <restaurant_name> <cuisine> <count> [description]
    restaurant_name = sys.argv[1] if len(sys.argv) > 1 else "Aretti"
    cuisine = sys.argv[2] if len(sys.argv) > 2 else "Italian"
    count = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    description = sys.argv[4] if len(sys.argv) > 4 else None

    generator = EvaluationDataGenerator()
    reviews, output_path = generator.generate_for_restaurant(
        restaurant_name=restaurant_name,
        cuisine=cuisine,
        count=count,
        restaurant_description=description
    )
