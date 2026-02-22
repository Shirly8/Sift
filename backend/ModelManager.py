"""
ModelManager: Handles model downloading, versioning, and loading

Features:
- Auto-downloads base model from Hugging Face on first run
- Tracks fine-tuned model versions
- Manages model registry (which model is active)
- Returns which model to use for inference or training
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForSequenceClassification


class ModelManager:
    """Manages model downloading and training

    Simple flow:
    1. If Models/ doesn't exist → Download from HF
    2. User trains → Overwrites Models/ with new version
    3. To reset → Delete Models/ folder
    """

    def __init__(self):
        self.base_model_id = "Shirlyh8/Servicer-ABSA"
        self.models_dir = os.path.join(os.path.dirname(__file__), "Models")
        os.makedirs(self.models_dir, exist_ok=True)


    ####################################
    # MODEL DOWNLOADING
    ####################################

    def download_base_model(self):
        """Download base model from Hugging Face to Models/"""
        print(f"📥 Downloading base model from Hugging Face ({self.base_model_id})...")

        try:
            tokenizer = AutoTokenizer.from_pretrained(self.base_model_id)
            model = AutoModelForSequenceClassification.from_pretrained(self.base_model_id)

            model.save_pretrained(self.models_dir)
            tokenizer.save_pretrained(self.models_dir)

            print(f"✓ Model saved to {self.models_dir}")
            return True
        except Exception as e:
            print(f"✗ Failed to download model: {e}")
            print("Make sure you have installed sentencepiece: pip install sentencepiece")
            return False

    ####################################
    # MODEL LOADING
    ####################################

    def get_active_model(self):
        """Returns path to the model (auto-downloads if missing)"""
        # Check if model exists in Models/
        if self._has_model():
            return os.path.abspath(self.models_dir), "current"

        # Download if missing
        if self.download_base_model():
            return os.path.abspath(self.models_dir), "current"

        raise RuntimeError(
            "Failed to load or download model. "
            "Please ensure sentencepiece is installed: pip install sentencepiece"
        )

    def _has_model(self):
        """Check if a model exists in Models/ directory"""
        config_exists = os.path.exists(os.path.join(self.models_dir, "config.json"))
        # Accept either pytorch_model.bin (older) or model.safetensors (newer)
        model_exists = (
            os.path.exists(os.path.join(self.models_dir, "pytorch_model.bin")) or
            os.path.exists(os.path.join(self.models_dir, "model.safetensors"))
        )
        return config_exists and model_exists

    def get_model_status(self):
        """Returns model status"""
        model_exists = self._has_model()

        # Get accumulated training data count
        training_data_path = os.path.join(os.path.dirname(__file__),
                                         "Data/Training/user_accumulated.csv")
        training_count = 0
        if os.path.exists(training_data_path):
            with open(training_data_path, 'r') as f:
                training_count = sum(1 for _ in f) - 1  # -1 for header

        # Check for metadata
        last_trained = None
        metadata_path = os.path.join(self.models_dir, "metadata.json")
        if os.path.exists(metadata_path):
            try:
                with open(metadata_path, 'r') as f:
                    metadata = json.load(f)
                    last_trained = metadata.get("trained_at")
            except:
                pass

        return {
            "modelExists": model_exists,
            "activeModel": "current",
            "lastTrained": last_trained,
            "trainingDataCount": training_count,
        }

    def save_model(self, model, tokenizer, accuracy=None, loss=None):
        """Save trained model to Models/ (overwrites previous)"""
        model.save_pretrained(self.models_dir)
        tokenizer.save_pretrained(self.models_dir)

        # Save metadata
        metadata = {
            "trained_at": datetime.now().isoformat(),
            "trained_on": "user_accumulated.csv",
            "accuracy": accuracy,
            "loss": loss,
        }

        metadata_path = os.path.join(self.models_dir, "metadata.json")
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)

        print(f"✓ Model saved to {self.models_dir}")
        return self.models_dir

    def get_model_for_inference(self):
        """Load the active model for inference (returns model and tokenizer)"""
        model_path, model_name = self.get_active_model()

        try:
            tokenizer = AutoTokenizer.from_pretrained(model_path)
            model = AutoModelForSequenceClassification.from_pretrained(model_path)
            model.eval()

            print(f"✓ Loaded model: {model_name}")
            return model, tokenizer, model_name
        except Exception as e:
            print(f"✗ Failed to load model {model_path}: {e}")
            return None, None, None


if __name__ == "__main__":
    manager = ModelManager()
    status = manager.get_model_status()
    print(json.dumps(status))
