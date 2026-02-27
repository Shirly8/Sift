"""
Routes Ollama, Claude, OpenAI, or Gemini

Provider auto-detected from env vars (or set LLM_PROVIDER explicitly):
  ANTHROPIC_API_KEY  -> claude
  OPENAI_API_KEY     -> openai
  GEMINI_API_KEY     -> gemini
  (none)             -> ollama  (default for dev)

Usage:
  response = call_llm("Categorize this merchant: STARBUCKS")
  -> "Dining"
"""

import os
import re
import time


PRICING = {
    "claude-haiku-4-5-20251001": {"input": 0.80,  "output": 4.00},
    "claude-sonnet-4-6":         {"input": 3.00,  "output": 15.00},
    "gpt-4o-mini":               {"input": 0.15,  "output": 0.60},
    "gpt-4o":                    {"input": 2.50,  "output": 10.00},
    "gemini-1.5-flash":          {"input": 0.075, "output": 0.30},
    "gemini-1.5-pro":            {"input": 1.25,  "output": 5.00},
}

COST_WARN  = 0.50
COST_ABORT = 1.00

_provider       = None
_default_model  = None
_clients        = {}            # provider -> reusable client instance
_session_cost   = 0.0           # cumulative cost of session (dollars)
_session_tokens = 0



####################################
# STEP 1: INITIALIZE & AUTO-DETECT PROVIDER
####################################

def initialize_llm_client(provider: str = None):
    """
    Priority: LLM_PROVIDER env var > API key detection > ollama fallback.
    """
    
    global _provider, _default_model

    if provider:
        os.environ["LLM_PROVIDER"] = provider

    explicit = os.getenv("LLM_PROVIDER", "").lower()

    if explicit == "claude" or (not explicit and os.getenv("ANTHROPIC_API_KEY")):
        _provider = "claude"
        _default_model = os.getenv("CLAUDE_MODEL", "claude-haiku-4-5-20251001")

    elif explicit == "openai" or (not explicit and os.getenv("OPENAI_API_KEY")):
        _provider = "openai"
        _default_model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    elif explicit == "gemini" or (not explicit and os.getenv("GEMINI_API_KEY")):
        _provider = "gemini"
        _default_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    else:
        _provider = "ollama"
        _default_model = os.getenv("OLLAMA_MODEL", "llama3.1:8b")

    print(f"LLM provider: {_provider} | model: {_default_model}")
    return _provider



####################################
# STEP 2: PROVIDER IMPLEMENTATIONS
####################################

def _call_claude(prompt, model, temperature, max_tokens) -> str:
    if "claude" not in _clients:
        import anthropic
        _clients["claude"] = anthropic.Anthropic(
            api_key=os.environ["ANTHROPIC_API_KEY"],
            timeout=30.0,
        )

    response = _clients["claude"].messages.create(
        model=model, max_tokens=max_tokens, temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    _track_usage(response.usage.input_tokens, response.usage.output_tokens, model)
    return response.content[0].text.strip()


def _call_openai(prompt, model, temperature, max_tokens) -> str:
    if "openai" not in _clients:
        try:
            import openai
        except ImportError:
            raise RuntimeError("Run: pip install openai")
        _clients["openai"] = openai.OpenAI(api_key=os.environ["OPENAI_API_KEY"])

    response = _clients["openai"].chat.completions.create(
        model=model, max_tokens=max_tokens, temperature=temperature,
        messages=[{"role": "user", "content": prompt}],
    )
    _track_usage(response.usage.prompt_tokens, response.usage.completion_tokens, model)
    return response.choices[0].message.content.strip()


def _call_gemini(prompt, model, temperature, max_tokens) -> str:
    if "gemini" not in _clients:
        try:
            import google.generativeai as genai
        except ImportError:
            raise RuntimeError("Run: pip install google-generativeai")
        genai.configure(api_key=os.environ["GEMINI_API_KEY"])
        _clients["gemini"] = genai

    response = _clients["gemini"].GenerativeModel(model).generate_content(
        prompt,
        generation_config=_clients["gemini"].types.GenerationConfig(
            temperature=temperature, max_output_tokens=max_tokens,
        ),
    )

    if hasattr(response, "usage_metadata") and response.usage_metadata:
        _track_usage(
            getattr(response.usage_metadata, "prompt_token_count", 0) or 0,
            getattr(response.usage_metadata, "candidates_token_count", 0) or 0,
            model,
        )

    return response.text.strip()


def _call_ollama(prompt, model, temperature, max_tokens) -> str:
    import httpx

    base_url = os.getenv("OLLAMA_HOST", "http://localhost:11434")
    response = httpx.post(
        f"{base_url}/api/chat",
        json={
            "model":   model,
            "messages": [{"role": "user", "content": prompt}],
            "stream":  False,
            "options": {"temperature": temperature, "num_predict": max_tokens},
        },
        timeout=90.0,
    )
    response.raise_for_status()
    return response.json()["message"]["content"].strip()


_DISPATCH = {
    "claude": _call_claude,
    "openai": _call_openai,
    "gemini": _call_gemini,
    "ollama": _call_ollama,
}




####################################
# STEP 3: COST TRACKING
####################################

def _estimate_cost(input_tokens: int, output_tokens: int, model: str = None) -> float:
    """Calculate cost in dollars for given token usage."""
    prices = PRICING.get(model, {"input": 0.0, "output": 0.0})
    return (input_tokens / 1_000_000) * prices["input"] + \
           (output_tokens / 1_000_000) * prices["output"]


def _track_usage(input_tokens: int, output_tokens: int, model: str):
    """Track tokens and cost for this session."""
    global _session_cost, _session_tokens
    cost = _estimate_cost(input_tokens, output_tokens, model)
    _session_cost += cost
    _session_tokens += input_tokens + output_tokens
    if _session_cost > COST_WARN:
        print(f"Warning: Session LLM cost at ${_session_cost:.2f}")



####################################
# STEP 4: UNIFIED CALL (with retry)
####################################

def call_llm(prompt: str, temperature: float = 0.0, max_tokens: int = 500, model: str = None) -> str:

    global _provider, _default_model

    if _provider is None:
        initialize_llm_client()

    if _session_cost > COST_ABORT:
        raise RuntimeError(f"Session cost ${_session_cost:.2f} exceeded abort limit ${COST_ABORT}")

    fn    = _DISPATCH.get(_provider)
    model = model or _default_model

    if not fn:
        raise ValueError(f"Unknown provider: {_provider}")

    for attempt in range(3):
        try:
            return fn(prompt, model, temperature, max_tokens)
        except Exception as e:
            if attempt == 2:
                print(f"LLM call failed after 3 attempts: {e}")
                return None
            wait = 2 ** attempt
            print(f"LLM error (attempt {attempt + 1}): {e} — retrying in {wait}s")
            time.sleep(wait)



####################################
# STEP 5: JSON EXTRACTION
####################################

def extract_json(raw: str) -> str:
    """
    LLMs often wrap JSON in ```json ... ``` — strip it before parsing.

      extract_json('```json\\n{"a": 1}\\n```')  ->  '{"a": 1}'
      extract_json('{"a": 1}')                  ->  '{"a": 1}'
      extract_json(None)                         ->  '{}'
    """

    if not raw:
        return "{}"

    # fenced code block
    match = re.search(r"```(?:json)?\s*([\s\S]*?)```", raw)
    if match:
        return match.group(1).strip()

    # bare JSON array in surrounding text
    match = re.search(r"(\[[\s\S]*\])", raw)
    if match:
        return match.group(1).strip()

    # bare JSON object in surrounding text
    match = re.search(r"(\{[\s\S]*\})", raw)
    if match:
        return match.group(1).strip()

    return raw.strip()



