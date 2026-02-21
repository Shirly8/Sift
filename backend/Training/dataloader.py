import os
import xml.etree.ElementTree as ET
import urllib.request
import pandas as pd
import torch
import random
from torch.utils.data import Dataset
from transformers import AutoTokenizer


BASE_MODEL = "yangheng/deberta-v3-base-absa-v1.1"

# 0 = negative, 1 = neutral, 2 = positive
POLARITY_MAP = {
    "positive": 2,
    "neutral": 1,
    "negative": 0,
}

def rating_to_label(rating):
    #map 1-5 star ratings to 0/1/2
    if rating >= 4:
        return 2
    elif rating == 3:
        return 1
    else:
        return 0



####################################
# STEP 1: LOAD TRAINING CSV
####################################

def load_csv(csv_path):
    """Load absa_training.csv → (review, aspect, label) tuples"""

    df = pd.read_csv(csv_path)
    samples = []

    for _, row in df.iterrows():
        review = str(row['review'])
        aspect = str(row['aspect'])
        label = rating_to_label(int(row['rating']))
        samples.append((review, aspect, label))

    print(f"Loaded {len(samples)} samples from {csv_path}")
    return samples



####################################
# STEP 2: LOAD MAMS XML
####################################

MAMS_TRAIN_URL = "https://raw.githubusercontent.com/siat-nlp/MAMS-for-ABSA/master/data/MAMS-ATSA/raw/train.xml"
MAMS_VAL_URL   = "https://raw.githubusercontent.com/siat-nlp/MAMS-for-ABSA/master/data/MAMS-ATSA/raw/val.xml"

def load_mams_xml(url):
    """Fetch MAMS XML from GitHub → (sentence, aspect_term, label) tuples"""

    with urllib.request.urlopen(url) as response:
        xml_bytes = response.read()

    root = ET.fromstring(xml_bytes)
    samples = []

    for sentence in root.findall(".//sentence"):
        text = sentence.find("text")
        if text is None:
            continue

        review = text.text.strip()

        for term in sentence.findall(".//aspectTerm"):
            polarity = term.get("polarity", "").lower()
            aspect = term.get("term", "")

            #skip conflict or missing
            if polarity not in POLARITY_MAP or not aspect:
                continue

            label = POLARITY_MAP[polarity]
            samples.append((review, aspect, label))

    print(f"Loaded {len(samples)} samples from MAMS ({url.split('/')[-1]})")
    return samples



####################################
# STEP 3: DATASET CLASS
####################################

class ABSADataset(Dataset):
    def __init__(self, samples, tokenizer, max_length=128):
        self.samples = samples
        self.tokenizer = tokenizer
        self.max_length = max_length

    def __len__(self):
        return len(self.samples)

    def __getitem__(self, idx):
        review, aspect, label = self.samples[idx]

        #tokenize as "[CLS] review [SEP] aspect [SEP]"
        encoded = self.tokenizer(
            review,
            aspect,
            max_length=self.max_length,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        return {
            'input_ids': encoded['input_ids'].squeeze(0),
            'attention_mask': encoded['attention_mask'].squeeze(0),
            'label': torch.tensor(label, dtype=torch.long)
        }



####################################
# STEP 4: BUILD TRAIN/VAL SPLITS
####################################

def build_datasets(csv_path, tokenizer, use_mams=True, val_split=0.1):
    """Load training CSV + optional MAMS, split 90/10 train/val"""

    samples = load_csv(csv_path)

    if use_mams:
        samples += load_mams_xml(MAMS_TRAIN_URL)
        samples += load_mams_xml(MAMS_VAL_URL)

    #shuffle then split
    random.shuffle(samples)
    split = int(len(samples) * (1 - val_split))

    train = samples[:split]
    val = samples[split:]

    print(f"Train: {len(train)} | Val: {len(val)}")

    return ABSADataset(train, tokenizer), ABSADataset(val, tokenizer)



if __name__ == "__main__":

    tokenizer = AutoTokenizer.from_pretrained(BASE_MODEL)

    #path relative to this file → backend/Data/Training/absa_training.csv
    csv_path = os.path.join(os.path.dirname(__file__), "../Data/Training/absa_training.csv")

    train_ds, val_ds = build_datasets(
        csv_path=csv_path,
        tokenizer=tokenizer
    )

    #quick sanity check
    sample = train_ds[0]
    print(sample['input_ids'].shape)
    print("label:", sample['label'])
