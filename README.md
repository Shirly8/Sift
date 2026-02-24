# Sift — Agentic Spending Intelligence

Analyzes personal transaction data to surface compound insights across five statistical tools. Adapts to your data — skips analyses when data is insufficient, cross-references results across tools, and routes follow-up questions to real computations (not LLM guesses).


## Architecture

```
CSV Upload
    │
    ▼
Ingestion       format detection → normalization → deduplication → quality scoring
    │
    ▼
Categorization  rules engine (70%+ coverage, $0) → merchant cache → LLM fallback
    │
    ▼
Agent           orchestrator: profile → plan → execute (adapts to data)
                  • temporal patterns   (payday, weekly, seasonal)
                  • anomaly detection   (outliers, spending spikes, new merchants)
                  • subscription hunter (recurring charges, price creep, overlap)
                  • behavioral correlation (Bonferroni-corrected)
                  • spending impact attribution
                synthesizer: cross-references tools → compound insights by dollar impact
                conversational agent: routes questions → computation tools → LLM explains
```


## Setup

```bash
git clone <repo-url>
cd Sift
cp backend/.env.example backend/.env   # add your API key
./start.sh                             # installs deps, starts backend + frontend
```

Frontend → http://localhost:3000
Backend  → http://localhost:5001

### LLM Providers

| Env Var | Provider | Cost |
|---------|----------|------|
| `ANTHROPIC_API_KEY` | Claude | ~$3/1M tokens |
| `OPENAI_API_KEY` | OpenAI | ~$2.50/1M tokens |
| `GEMINI_API_KEY` | Gemini | ~$1.25/1M tokens |
| *(none)* | Ollama (local) | Free |



## Design Decisions

**Rules-first, not AI-first** — Rules handle 70%+ of merchants at zero cost. LLM only sees genuinely ambiguous cases. With financial analysis scaling (~1M users), ~$1.4M/month saved vs classifying everything with LLM.

**Std ranking over regression for spending impact** — Linear regression where Y = sum of X is tautological (R² always ~1.0). Standard deviation ranking measures variance contribution honestly.

**Bonferroni correction on correlations** — With N categories there are N(N-1)/2 pairs to test. Uncorrected testing inflates false positives. Bonferroni ensures only robust correlations surface.

**Neutral framing** — Banned words: `should`, `bad`, `problem`, `waste`, `too much`. Insights present data, not judgment.
