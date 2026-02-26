# Sift

Turns bank statements into insights. Runs five statistical tools on your transaction data, skips analyses that don't have enough data, and lets you ask follow-up questions that actually compute instead of guess.

## Pipeline

```mermaid
%%{init: {'theme':'base', 'themeVariables': {'primaryColor':'#CF5532', 'primaryTextColor':'#fff', 'primaryBorderColor':'#D4735A', 'lineColor':'#D4915E', 'tertiaryColor':'#FFFFFF', 'tertiaryBorderColor':'#D4915E', 'background':'#FFF8F5', 'mainBkg':'#FFFFFF', 'clusterBkg':'#FFFFFF'}}}%%
flowchart TD
    CSV["CSV Upload"]

    subgraph INGEST["Ingestion"]
        direction LR
        I1["Format Detect"] --> I2["Normalize"] --> I3["Dedupe"] --> I4["Quality Score"]
    end

    subgraph CAT["Categorization"]
        direction LR
        C1["Rules<br/>70%"] -->|miss| C2["Cache"] -->|miss| C3["LLM"]
    end

    subgraph AGENT["Agent"]
        direction LR
        A1["Profile"] --> A2["Plan"] --> A3["Execute"]
    end

    subgraph TOOLS["Analysis"]
        direction TB
        T1["Temporal (payday, weekly, seasonal - min 90d)"]
        T2["Anomaly (outliers, spikes, new - no min)"]
        T3["Subscriptions (recurring, price creep - min 100 txns)"]
        T4["Correlations (Pearson+BH FDR - min 90d, 3 cats)"]
        T5["Spending Impact (std-dev ranking - min 180d, 5 cats)"]
    end

    subgraph SYNTH["Synthesize"]
        direction LR
        S1["Cross-ref"] --> S2["Rank by $"] --> S3["3-5 insights"]
    end

    CSV --> INGEST --> CAT --> AGENT --> TOOLS --> SYNTH --> DASH["Dashboard"]
    DASH -->|Questions| CONV["Conversational<br/>Agent"]
    CONV --> DASH

    C3 -.->|ambiguous| LLM["LLM"]
    SYNTH -.->|synthesize| LLM
    CONV -.->|explain| LLM
```

### Tech
Claude, OpenAI, Gemini, or local Ollama for LLM calls.

## Why This Way

**Rules first** — Merchants are deterministic 70% of the time. Only LLM the ambiguous 30%. At scale (~1M users), saves ~$1.4M/month vs classifying everything.

**Std-dev ranking, not regression** — Linear regression where output = sum of inputs is circular (R² ≈ 1.0 always). Ranking by standard deviation actually measures what's driving variance.

**Bonferroni on correlations** — With N categories, there are N(N-1)/2 pairs to test. No correction = false positive spam. Bonferroni ensures only real correlations surface.

## Human Boundary — What the AI Must Never Decide

Sift's AI sees numbers, not context. It cannot know if someone depends on a subscription for their mental health, or is already food-insecure. The system enforces this boundary at three layers:

1. **Prompt guardrail** — The LLM is explicitly told to never suggest reducing essentials (groceries, rent, healthcare, utilities, childcare, education, insurance).
2. **Computation whitelist** — `generate_savings_plan()` only targets discretionary categories (dining, shopping, entertainment, etc.). Essentials are structurally excluded from savings recommendations.
3. **Post-generation filter** — `validate_insight_framing()` rejects any insight that slips through and suggests cutting an essential category.

The critical human decision: **whether to actually change spending behavior**. Sift surfaces patterns and options — the human decides what matters in their life.
