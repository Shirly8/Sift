# Servicer 2.0

Aspect-Based Sentiment Analysis platform that tells businesses **which review aspects actually drive their ratings**. Powered by real Google Maps reviews.

**Core value prop:** Don't just know your sentiment score. Know that fixing "Service" will move your rating more than fixing "Ambience."

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                      DATA PIPELINE                           │
│                                                              │
│  Google Maps Reviews (via Outscraper) → Raw Reviews CSV      │
│  (3 real restaurants, 500 reviews each)                      │
│                                                              │
│  Synthetic Generator (Ollama) → Training Augmentation CSV    │
│  (Fill gaps in underrepresented aspects/ratings)             │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                      ML PIPELINE (Local)                     │
│                                                              │
│  1. Aspect Discovery Layer                                   │
│     └─ Hybrid: Keyword Match + Semantic Similarity           │
│        └─ SentenceTransformer (all-MiniLM-L6-v2)            │
│        └─ Cosine similarity against aspect embeddings        │
│        └─ Human-in-the-loop: accept/reject discovered aspects│
│                                                              │
│  2. ABSA Model                                               │
│     └─ DeBERTa fine-tuned for (sentence, aspect) → 1-5 stars│
│     └─ Input: "[CLS] review [SEP] aspect [SEP]"             │
│     └─ PyTorch Lightning, AdamW, 3 epochs                    │
│                                                              │
│  3. Impact Attribution (NEW - The WOW Factor)                │
│     └─ Correlation analysis: which aspects predict           │
│        overall star rating?                                  │
│     └─ Output: "Service drives 40% of your rating"           │
│     └─ Regression coefficients per aspect                    │
│                                                              │
│  4. Evaluator                                                │
│     └─ Accuracy, Precision, Recall, F1 (weighted)            │
│     └─ Per-aspect breakdown                                  │
│     └─ Writes evaluation_results.json                        │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│               PRE-COMPUTED RESULTS (JSON)                    │
│                                                              │
│  All ML outputs baked into static JSON files:                │
│  ├── aspect_sentiments.json     (per-review aspect scores)   │
│  ├── impact_attribution.json    (aspect → rating impact %)   │
│  ├── aspect_trends.json         (sentiment over time)        │
│  ├── evaluation_results.json    (model performance)          │
│  └── review_data.json           (processed reviews + meta)   │
│                                                              │
│  Frontend reads these directly. No live backend needed.      │
└──────────────────────┬───────────────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────────────────────┐
│              FRONTEND DASHBOARD (Vercel)                      │
│              React + Vite + TypeScript                        │
│                                                              │
│  Reads pre-computed JSON. No backend dependency.             │
│  Users can also run backend locally for live analysis.       │
└──────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Data Pipeline

#### Google Maps Reviews
- Source: Outscraper (outscraper.com) — exported as CSV
- 3 Toronto restaurants: PAI, 360 The Restaurant, McDonald's
- Collects: review text, star rating, date
- Output: `data/raw_reviews.csv` (columns: `restaurant`, `review`, `rating`, `date`)
- Target: 500 reviews per restaurant, 1500 total

#### Synthetic Data (Training Augmentation Only)
- Kept from Servicer 1.0 but role changes: **augmentation, not primary data**
- Use only to fill gaps (e.g., if real data has 5 "Location" reviews but 200 "Food" reviews)
- Ollama (llama3:8b) generates aspect-specific reviews
- Mixed generation: 60% single-aspect, 40% multi-aspect
- Output: `data/synthetic_augmentation.csv`

### 2. Aspect Discovery Layer

#### Hybrid Aspect Discovery (Dynamic, Not Predefined)
- **Step 1 — Semantic Clustering**: Embed all review sentences with SentenceTransformer. Cluster similar phrases. Surface candidate aspects.
- **Step 2 — Keyword Matching**: Match known phrases to canonical aspects (Service, Food Quality, Ambience, Price, etc.)
- **Step 3 — Human-in-the-Loop**: Dashboard shows discovered aspects as suggestions. Business owner accepts, rejects, or renames aspects before analysis runs.

This means aspects are **discovered from the data**, not hardcoded. A hotel dataset would surface "Room Cleanliness" and "Check-in." A restaurant surfaces "Pasta" and "Wait Times."

#### Aspect Categories (Default Seed List)
Starting seed for restaurants. Discovery layer can add/remove:
```
Service, Ambience, Price, Food Quality, Taste, Menu, Location, Drinks, Desserts
```

### 3. ABSA Model

#### Architecture
- Base: DeBERTa (HuggingFace `AutoModelForSequenceClassification`)
- Task: 5-class classification (1-5 stars per aspect)
- Input format: `"[CLS] review text [SEP] aspect name [SEP]"`
- Framework: PyTorch Lightning

#### Training
- Data: SemEval 2014 restaurant dataset (labeled) + synthetic augmentation (gap-filling)
- Split: 90% train / 10% validation
- Hyperparameters: batch_size=15, max_length=128, lr=2e-5, epochs=3
- Optimizer: AdamW with linear warmup scheduler
- Checkpointing: Best model by validation F1
- Early stopping: 3 epochs patience on val_f1

#### Inference
- SemanticAnalyzer receives review text
- Discovers relevant aspects (hybrid: keyword + semantic similarity)
- For each aspect: tokenize as sentence-aspect pair → model → logits → argmax → 1-5 stars
- Returns: `{ "Service": 4, "Food Quality": 2, "Ambience": 5 }`

### 4. Impact Attribution (NEW)

The differentiator. Answers: **"Which aspects actually move your overall rating?"**

#### Method
- Input: All reviews with (overall_rating, aspect_scores) pairs
- Run multivariate linear regression: `overall_rating ~ service_score + food_score + ambience_score + ...`
- Extract standardized coefficients → normalize to percentages
- Output: `{ "Food Quality": 0.45, "Service": 0.32, "Ambience": 0.15, "Price": 0.08 }`
- Interpretation: "Food Quality drives 45% of your overall rating"

#### Correlation Matrix
- Compute pairwise correlations between all aspects
- Surface: "High Service scores correlate with high Ambience scores (r=0.72)"
- Surface: "Price satisfaction is independent of Food Quality (r=0.11)"

#### Output
- `impact_attribution.json`: aspect weights, correlation matrix, confidence intervals
- Pre-computed once locally. Frontend reads it statically.

### 5. Evaluator

- Metrics: Accuracy, Precision, Recall, F1 (weighted)
- Per-aspect breakdown: which aspects does the model predict best/worst?
- Aspect discovery recall: % of labeled aspects correctly identified
- Output: `evaluation_results.json`

---

## Dashboard Specification

### Deployment Model

**Recommended: Vercel Only (No Backend)**

- **Vercel (frontend only)**:
  - Reads pre-computed JSON files (from `export_dashboard_data.py`)
  - CSV upload & single review analysis use **client-side model** (ONNX export of DeBERTa)
  - Model training disabled (shows warning on Vercel)
  - **Zero backend needed** - all processing in browser
  - Works offline
  - CSV uploads add restaurants to dropdown automatically
  - Can delete restaurants from dropdown
  - Cost: Free (Vercel free tier)

**Optional: Local Development with Live Backend**

- **Local mode** (development only):
  - Run `python backend/main.py` → Flask serves live analysis endpoints
  - Frontend detects backend and uses it for faster processing
  - CSV upload can use backend (faster than browser)
  - Full model training enabled (admin/owner only)
  - **Not recommended for Render/cloud deployment** - DeBERTa exceeds free tier resource limits (2-4GB RAM needed, free tier = 0.5GB)

### Tech Stack
- React 18 + TypeScript + Vite
- Tailwind CSS (clean, utility-first)
- Recharts or D3.js for visualizations
- Framer Motion for transitions

---

### Page Layout

#### Header Bar
- Servicer 2.0 logo (left)
- **Restaurant Selector Dropdown & Management**
  - Shows all loaded restaurants (initial data + CSV uploads)
  - Click restaurant name → view its dashboard
  - **Add restaurant**: (+) button → CSV Upload → auto-adds to dropdown
  - **Delete restaurant**: [⋮] menu next to dropdown → "Delete Restaurant" → removes from data
  - Deleting a restaurant removes its data from browser (localStorage)
- "Powered by 1,500 real Google Maps reviews" badge
- (+) button → Opens modal for:
  - CSV upload (batch analyze restaurants)
  - Model evaluation metrics popup
  - Training option (admin/business owner only, local-only)

---

#### Section 1: Overview Cards (Top Row)

Four metric cards, horizontal row:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Overall Score   │  │  Total Reviews   │  │  Top Strength    │  │  Top Weakness    │
│                  │  │                  │  │                  │  │                  │
│     4.2 / 5      │  │      1,247       │  │  Food Quality    │  │    Service       │
│   ▲ +0.3 (30d)   │  │                  │  │    4.6 ★         │  │    2.8 ★         │
└─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────────┘
```

- Overall Score: weighted average across all aspects. Trend arrow (up/down vs last 30 days).
- Total Reviews: count of analyzed reviews.
- Top Strength: highest-rated aspect with score.
- Top Weakness: lowest-rated aspect with score.

---

#### Section 2: Impact Attribution (THE WOW FACTOR)

Title: **"What Drives Your Rating?"**

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  Food Quality    ██████████████████████████████████████  45%    │
│  Service         ████████████████████████               32%    │
│  Ambience        ███████████                            15%    │
│  Price           █████                                   8%    │
│                                                                │
│  💡 Insight: "Improving Food Quality by 1 star would have      │
│     3x more impact on your rating than improving Price."       │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

- Horizontal bar chart showing each aspect's contribution to overall rating
- Bars color-coded: green (>30%), yellow (15-30%), grey (<15%)
- Auto-generated insight sentence below the chart
- Derived from regression coefficients in `impact_attribution.json`

---

#### Section 3: Aspect Breakdown Grid

Title: **"Aspect Performance"**

```
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  Food Quality  4.6★   │  │  Service       2.8★   │  │  Ambience      4.1★   │
│  ████████████████░░░  │  │  ██████████░░░░░░░░░  │  │  ██████████████░░░░░  │
│                       │  │                       │  │                       │
│  Based on 487 reviews │  │  Based on 312 reviews │  │  Based on 198 reviews │
│  ▲ +0.2 (30d)         │  │  ▼ -0.4 (30d)         │  │  — stable             │
│                       │  │                       │  │                       │
│  Top keyword: "fresh" │  │  Top keyword: "slow"  │  │  Top keyword: "cozy"  │
│  [View Reviews →]     │  │  [View Reviews →]     │  │  [View Reviews →]     │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

Each card:
- Aspect name + average score (1-5 stars)
- Progress bar (filled proportionally)
- Review count for this aspect
- Trend indicator (up/down/stable vs 30 days ago)
- Top associated keyword from reviews
- Click to expand → shows actual review excerpts for this aspect

---

#### Section 4: Sentiment Distribution Heatmap

Title: **"Rating Distribution by Aspect"**

```
              1★      2★      3★      4★      5★
Food Quality  ░░      ░░      ▒▒      ▓▓      ██
Service       ▓▓      ▓▓      ▒▒      ░░      ░░
Ambience      ░░      ░░      ░░      ▓▓      ██
Price         ░░      ▒▒      ▓▓      ▒▒      ░░
Taste         ░░      ░░      ░░      ▒▒      ██
```

- Heatmap grid: rows = aspects, columns = 1-5 stars
- Cell intensity = % of reviews at that rating for that aspect
- Instantly shows: "Service is bimodal (lots of 1★ and 5★)" vs "Price is clustered at 3★"

---

#### Section 5: Review Explorer

Title: **"Review Deep Dive"**

```
┌─────────────────────────────────────────────────────────────────┐
│  Filter: [All Aspects ▼]  [All Ratings ▼]  [Search...       ]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ★★★★★  "The pasta was incredible, perfectly al dente..."       │
│         Aspects: Food Quality (5★) · Taste (5★)                │
│                                                                 │
│  ★★☆☆☆  "Waited 45 minutes for our appetizers..."              │
│         Aspects: Service (1★) · Food Quality (3★)              │
│                                                                 │
│  ★★★★☆  "Great ambience but slightly overpriced..."            │
│         Aspects: Ambience (5★) · Price (2★)                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Scrollable list of actual reviews (real Google Maps reviews via Outscraper)
- Each review shows: overall rating, review text, discovered aspects with per-aspect scores
- Filter by aspect, rating, or keyword search
- Aspect tags are color-coded (green = 4-5★, yellow = 3★, red = 1-2★)

---

#### Section 6: Live Analysis & CSV Upload

##### Subsection A: Single Review Analysis

Title: **"Analyze a Review"**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  [Enter any review text here...                              ]  │
│                                                  [Analyze →]    │
│                                                                 │
│  Results:                                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ Service  4★  │  │ Food     2★  │  │ Ambience 5★  │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Text input for ad-hoc review analysis
- **Vercel mode**: Uses optimized client-side model (DistilBERT or ALBERT in ONNX format, ~50-100MB)
  - Runs locally in browser
  - First load: ~30-60 seconds (model download + cache)
  - Subsequent loads: instant (cached)
- **Local mode**: Frontend detects backend at localhost:5000
  - Hits Flask `/analyzeSentiment` endpoint
  - Uses full DeBERTa model (faster, more accurate)
  - Recommended for better accuracy if local backend available
- Shows aspect cards with sentiment scores
- Status indicator: "Using Local Model" or "Using Cloud Model"

##### Subsection B: CSV Batch Upload

Accessible via header **(+)** button:

```
┌─────────────────────────────────────────────────────────────────┐
│  CSV Upload: Analyze Multiple Reviews                           │
│                                                                 │
│  [Upload CSV...] ← Format: text, rating, review_date (optional)│
│                                                                 │
│  Processing... ████████████░░░░ 75%                            │
│                                                                 │
│  Results:                                                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Review #1  │ Food: 5★ │ Service: 4★ │ Ambience: 5★ │ ✓     │ │
│  │ Review #2  │ Food: 2★ │ Service: 1★ │ Ambience: 3★ │ ✓     │ │
│  │ Review #3  │ Food: 4★ │ Service: 4★ │ Ambience: 4★ │ ✓     │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                    [Download CSV]│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Upload CSV file with review data (format: text, rating, review_date optional)
- **Processing logic**:
  - **Vercel**: Runs in browser with client-side model (DistilBERT/ALBERT)
  - **Local dev with backend**: Detects localhost:5000 → uses backend (DeBERTa, faster)
  - **Local dev without backend**: Falls back to browser model
- **Adds new restaurant to dropdown** - uploaded data becomes available in restaurant selector
- Shows processing progress (per-row)
- Downloadable results CSV with all aspect scores
- Results dashboard immediately shows metrics for the new restaurant
- Status indicator shows which model was used ("Processed with Local/Cloud Model")

---

#### Section 7: Model Evaluation (Accessible via Header (+) Button)

Title: **"Model Performance"** (popup/modal in header)

```
┌─────────────────────────────────────────────────────────────────┐
│  Model Evaluation                                      [Close]   │
│                                                                 │
│  Model: DeBERTa (fine-tuned)     Dataset: 1,247 real reviews   │
│                                                                 │
│  Overall Accuracy: 82.4%   Precision: 0.81   Recall: 0.79     │
│  Weighted F1: 0.80                                              │
│                                                                 │
│  Per-Aspect Performance:                                        │
│  Food Quality: 0.87 F1  |  Service: 0.83 F1  |  Ambience: 0.78 │
│  Price: 0.71 F1         |  Taste: 0.85 F1    |  Menu: 0.79 F1  │
│                                                                 │
│  Aspect Discovery Recall: 91.2%                                │
│  (% of labeled aspects correctly identified)                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Shows model metrics from `evaluation_results.json`
- Accessible via header (+) button
- Demonstrates rigor and model accuracy
- Helps users understand confidence in results

---

#### Section 8: Model Training (Admin/Business Owner Only - Local Only)

Accessible via header **(+)** button (gated to authenticated users):

```
┌─────────────────────────────────────────────────────────────────┐
│  Train Custom Model (Local Only)                    [Close]      │
│                                                                 │
│  ⚠️  This feature runs locally and is not available on Vercel   │
│                                                                 │
│  Upload training data:  [Choose CSV...] (aspect+rating pairs)   │
│                                                                 │
│  Training settings:                                             │
│  ├─ Epochs: [3]                                                 │
│  ├─ Batch Size: [15]                                            │
│  └─ Learning Rate: [2e-5]                                       │
│                                                                 │
│  [Start Training] → Trains locally, exports updated model       │
│  Processing: ████████░░░░░░░░░░░░ 40% (2m 15s remaining)       │
│                                                                 │
│  ✓ Training complete! Model updated.                            │
│  New metrics: Accuracy 84.1% (↑ 1.7%)                           │
│  [Export Model] [Use New Model] [Discard]                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Gated to admin/business owner roles
- **Vercel**: Disabled with warning "This feature only works in local development"
- **Local development only**:
  - User uploads training CSV (aspect+rating pairs)
  - Frontend detects backend at localhost:5000
  - Calls `POST /train` endpoint
  - Backend runs training:
    - Uses `backend/sentiment/trainer.py`
    - PyTorch Lightning, GPU-accelerated
    - Trains on user's data + existing data
  - Backend returns updated model + new metrics
  - Frontend receives and caches updated ONNX model
  - User can test results immediately
  - **Note**: Training takes 2-10 minutes depending on data size
- Useful for customizing model to specific restaurant domain/data

---

#### Section 9: Restaurant Comparison (If Multi-Restaurant)

Title: **"Compare Restaurants"**

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  Aspect         Restaurant A    Restaurant B    Restaurant C    │
│  ─────────────  ──────────────  ──────────────  ──────────────  │
│  Food Quality   4.6 ★           3.9 ★           4.2 ★           │
│  Service        2.8 ★           4.5 ★           3.7 ★           │
│  Ambience       4.1 ★           3.2 ★           4.8 ★           │
│  Price          3.5 ★           3.8 ★           2.9 ★           │
│  ─────────────  ──────────────  ──────────────  ──────────────  │
│  Overall        3.9 ★           3.8 ★           4.0 ★           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

- Side-by-side comparison table
- Highlights: best-in-class per aspect (bold/green)
- Shows where each restaurant wins and loses

---

## File Structure

```
Servicer2.0/
├── README.md
├── backend/
│   ├── main.py                      # Flask app (local mode only)
│   ├── requirements.txt
│   ├── sentiment/
│   │   ├── model.py                 # ABSAClassifier (DeBERTa + PyTorch Lightning)
│   │   ├── trainer.py               # Fine-tuning pipeline
│   │   ├── dataloader.py            # ABSADataset (sentence-aspect pairs)
│   │   ├── semantic_analyzer.py     # Hybrid aspect discovery + sentiment scoring
│   │   ├── evaluator.py             # Metrics computation
│   │   ├── impact_attribution.py    # NEW: regression analysis (aspect → rating impact)
│   │   └── synthetic_generator.py   # Augmentation data (Ollama)
│   ├── data/
│   │   ├── raw_reviews.csv          # Google Maps reviews from Outscraper
│   │   ├── synthetic_augmentation.csv
│   │   └── processed_reviews.json   # ABSA results per review
│   └── models/
│       └── absa-v1/                 # Trained model checkpoint
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── public/
│   │   └── data/                    # Pre-computed JSON (baked for Vercel)
│   │       ├── aspect_sentiments.json
│   │       ├── impact_attribution.json
│   │       ├── aspect_trends.json
│   │       ├── evaluation_results.json
│   │       └── review_data.json
│   └── src/
│       ├── App.tsx
│       ├── pages/
│       │   └── Dashboard.tsx
│       ├── components/
│       │   ├── OverviewCards.tsx
│       │   ├── ImpactAttribution.tsx     # THE WOW FACTOR
│       │   ├── AspectGrid.tsx
│       │   ├── SentimentHeatmap.tsx
│       │   ├── ReviewExplorer.tsx
│       │   ├── LiveAnalysis.tsx
│       │   ├── ModelPerformance.tsx     # Evaluation metrics (modal via header button)
│       │   ├── CSVUploadModal.tsx       # Batch CSV analysis
│       │   ├── ModelTrainingModal.tsx   # Local model retraining (admin only)
│       │   ├── HeaderButton.tsx         # (+) button in header
│       │   └── RestaurantComparison.tsx
│       ├── hooks/
│       │   └── useDataLoader.ts          # Loads JSON or fetches from backend
│       └── utils/
│           └── calculations.ts
└── scripts/
    ├── train.py                     # Run: python scripts/train.py
    ├── evaluate.py                  # Run: python scripts/evaluate.py
    └── export_dashboard_data.py     # Run: python scripts/export_dashboard_data.py
                                     # Generates all JSON files for frontend
```

---

## Build & Run

### Recommended: Vercel Deployment (Simplest)

```bash
# 1. One-time setup: Train & export dashboard data locally
python scripts/train.py --data backend/data/raw_reviews.csv
python scripts/evaluate.py --model backend/models/absa-v1 --data backend/data/raw_reviews.csv
python scripts/export_dashboard_data.py --output frontend/public/data/

# 2. Build frontend
cd frontend
npm install && npm run build

# 3. Deploy to Vercel (connect GitHub repo)
# Vercel auto-builds on push. No backend needed.
```

**Result**: Users upload CSVs in the browser, model runs locally on their device. Zero backend costs.

---

### Optional: Local Development (If You Want Live Backend)

```bash
# Terminal 1: Backend (Flask) - serves live analysis endpoints
cd backend
pip install -r requirements.txt
python main.py  # Runs on localhost:5000

# Terminal 2: Frontend - detects backend and uses it
cd frontend
npm run dev  # Frontend at localhost:3000
# Auto-detects backend at localhost:5000 and enables live mode
```

**Note**: This is useful for development/testing, but NOT recommended for production deployment on Render/AWS due to DeBERTa resource requirements.

---

### Workflow: Adding New Restaurants

**On Vercel (no backend):**
```
1. User clicks (+) button → CSV Upload modal
2. Selects review CSV file
3. Frontend processes with DistilBERT in browser (~50-100MB model)
4. Results calculated (slow on large batches)
5. Restaurant added to dropdown selector
6. User views dashboard for that restaurant
7. To delete: click [⋮] menu → "Delete Restaurant"
```

**Local development (with backend):**
```
1. User clicks (+) button → CSV Upload modal
2. Selects review CSV file
3. Frontend detects localhost:5000 backend
4. Calls POST /analyze endpoint with CSV data
5. Backend processes with DeBERTa (fast, accurate)
6. Backend returns aspect scores
7. Restaurant added to dropdown selector
8. User views dashboard
9. To delete: click [⋮] menu → "Delete Restaurant"
```

---

### Backend API Endpoints (Local Development Only)

If you run `python backend/main.py`, these endpoints are available:

```
POST /analyzeSentiment
├─ Input: { "review": "Great food but slow service" }
├─ Returns: { "Food Quality": 5, "Service": 2 }
└─ Used by: Live Analysis form

POST /analyze
├─ Input: { "reviews": [...], "format": "csv" }
├─ Returns: Processed reviews with aspect scores
└─ Used by: CSV Upload modal

POST /train
├─ Input: { "trainingData": CSV, "epochs": 3, "batch_size": 15 }
├─ Returns: { "model": ONNX_bytes, "metrics": {...} }
└─ Used by: Model Training modal
└─ Note: GPU accelerated, takes 2-10 minutes

GET /health
├─ Returns: { "status": "ok" }
└─ Used by: Frontend to detect if backend is available
```

**Frontend detection logic:**
```typescript
// On page load, frontend tries to reach backend
fetch('http://localhost:5000/health')
  .then(() => {
    // Backend available - enable live mode
    showStatus("Using Cloud Model (backend)")
  })
  .catch(() => {
    // Backend unavailable - use browser model
    showStatus("Using Local Model (browser)")
  })
```

---

## What Makes This Win

1. **Real data, not synthetic** — "Analyzed 1,500 real Google Maps reviews from Toronto restaurants"
2. **Impact Attribution** — No one else tells you which aspects drive your rating. This is the headline feature.
3. **Dynamic aspect discovery** — Aspects come from the data, not a hardcoded list. Human-in-the-loop keeps it trustworthy.
4. **Flexible deployment** — Works on Vercel (client-side model) AND locally (backend + training). No vendor lock-in.
5. **CSV batch processing** — Analyze dozens of reviews at once. Export results as CSV.
6. **Custom model training** — Businesses can fine-tune the model on their own review data (local-only for now).
7. **Beautiful dashboard** — Production-grade UI that a restaurant owner would actually use
8. **Transparent ML** — Model metrics visible. Reviews traceable. No black box.
