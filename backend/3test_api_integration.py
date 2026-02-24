"""
End-to-End API Integration Test

Tests the full workflow:
1. Health check
2. Settings
3. Upload CSV → get session_id
4. Analyze with session_id
5. Ask a question
6. Correct a category
7. LLM categorization fallback

Run this AFTER starting the Flask app:
  export OLLAMA_MODEL=llama2:latest && python3 app.py
  # Then in another terminal:
  python3 3test_api_integration.py
"""

import os
import sys
import requests
import json
from pathlib import Path

# Configuration
API_BASE = "http://localhost:5001"
CSV_PATH = os.path.join(os.path.dirname(__file__), "Data/wealthsimple_demo.csv")

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'


def log_test(name):
    print(f"\n{BLUE}▶ {name}{RESET}")


def log_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")


def log_error(msg):
    print(f"{RED}✗ {msg}{RESET}")


def log_info(msg):
    print(f"  {YELLOW}→{RESET} {msg}")


def test_health_check():
    """Test /api/health-check"""
    log_test("Health Check")

    try:
        res = requests.get(f"{API_BASE}/api/health-check")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        assert data.get("status") == "ok", "Status should be 'ok'"

        log_success(f"API is healthy")
        return True
    except Exception as e:
        log_error(f"Health check failed: {e}")
        return False


def test_settings():
    """Test /api/settings"""
    log_test("Settings")

    try:
        res = requests.get(f"{API_BASE}/api/settings")
        assert res.status_code == 200

        data = res.json()
        assert "llm_provider" in data
        assert "model" in data

        log_success(f"LLM Provider: {data['llm_provider']}")
        log_success(f"Model: {data['model']}")
        return True
    except Exception as e:
        log_error(f"Settings failed: {e}")
        return False


def test_upload():
    """Test /api/upload"""
    log_test("Upload CSV")

    if not os.path.exists(CSV_PATH):
        log_error(f"CSV not found at {CSV_PATH}")
        return None

    try:
        with open(CSV_PATH, 'rb') as f:
            files = {'file': f}
            res = requests.post(f"{API_BASE}/api/upload", files=files)

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        assert data.get("status") == "success"
        assert "session_id" in data

        session_id = data["session_id"]
        summary = data.get("summary", {})

        log_success(f"Session ID: {session_id}")
        log_info(f"Total transactions: {summary.get('total')}")
        log_info(f"Categorized: {summary.get('categorized')} ({summary.get('coverage_pct')}%)")
        log_info(f"Needs LLM: {summary.get('needs_llm')}")
        log_info(f"Quality score: {summary.get('quality_score')}")
        log_info(f"Date range: {summary.get('date_range', {}).get('start')} → {summary.get('date_range', {}).get('end')}")

        return {
            "session_id": session_id,
            "data": data
        }
    except Exception as e:
        log_error(f"Upload failed: {e}")
        return None


def test_analyze(session_id):
    """Test /api/analyze"""
    log_test("Run Analysis")

    if not session_id:
        log_error("No session_id provided")
        return None

    try:
        res = requests.post(
            f"{API_BASE}/api/analyze",
            json={"session_id": session_id}
        )

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()

        # Check structure
        assert "profile" in data or "tools_run" in data or "insights" in data

        log_success(f"Analysis complete")

        if "profile" in data:
            log_info(f"Profile generated: {list(data['profile'].keys())}")

        if "tools_run" in data:
            log_info(f"Tools executed: {len(data['tools_run'])} tools")
            for tool in data['tools_run'][:3]:
                log_info(f"  - {tool.get('name', 'unnamed')}")

        if "insights" in data:
            log_info(f"Insights generated: {len(data.get('insights', []))} insights")
            for insight in data.get('insights', [])[:2]:
                log_info(f"  - {insight.get('title', 'unnamed')}")

        return data
    except Exception as e:
        log_error(f"Analysis failed: {e}")
        return None


def test_ask(session_id):
    """Test /api/ask"""
    log_test("Ask Question")

    if not session_id:
        log_error("No session_id provided")
        return None

    question = "What are my top spending categories?"

    try:
        res = requests.post(
            f"{API_BASE}/api/ask",
            json={
                "session_id": session_id,
                "question": question
            }
        )

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()

        log_success(f"Question answered")
        log_info(f"Question: {question}")

        if "answer" in data:
            answer = data["answer"][:200]  # First 200 chars
            log_info(f"Answer: {answer}...")

        if "tool_used" in data:
            log_info(f"Tool used: {data['tool_used']}")

        return data
    except Exception as e:
        log_error(f"Ask failed: {e}")
        return None


def test_correct_category():
    """Test /api/correct-category"""
    log_test("Correct Category (User Learning)")

    merchant = "MYSTERY SHOP"
    category = "Shopping"

    try:
        res = requests.post(
            f"{API_BASE}/api/correct-category",
            json={
                "merchant": merchant,
                "category": category
            }
        )

        assert res.status_code == 200

        data = res.json()
        assert data.get("status") == "learned"

        log_success(f"Learned: {merchant} → {category}")
        return True
    except Exception as e:
        log_error(f"Category correction failed: {e}")
        return False


def test_categorize_llm():
    """Test /api/categorize-llm"""
    log_test("LLM Categorization Fallback")

    merchants = ["MYSTERY SHOP", "UNKNOWN VENDOR"]

    try:
        res = requests.post(
            f"{API_BASE}/api/categorize-llm",
            json={"merchants": merchants}
        )

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        results = data.get("results", [])
        needs_review = data.get("needs_review", [])

        log_success(f"LLM categorized {len(results)} merchants")

        for result in results[:2]:
            log_info(f"{result.get('merchant')} → {result.get('category')} ({result.get('confidence'):.2f})")

        if needs_review:
            log_info(f"{len(needs_review)} results flagged for review")

        return data
    except Exception as e:
        log_error(f"LLM categorization failed: {e}")
        return None


def main():
    print(f"\n{BLUE}{'='*60}")
    print(f"API Integration Test Suite")
    print(f"{'='*60}{RESET}")
    print(f"Target: {API_BASE}")
    print(f"CSV: {CSV_PATH}")

    # Test 1: Health
    if not test_health_check():
        print(f"\n{RED}API is not responding. Start the Flask app first:{RESET}")
        print(f"  export OLLAMA_MODEL=llama2:latest && python3 app.py")
        return

    # Test 2: Settings
    test_settings()

    # Test 3: Upload
    upload_result = test_upload()
    if not upload_result:
        print(f"\n{RED}Upload failed. Cannot continue.{RESET}")
        return

    session_id = upload_result["session_id"]

    # Test 4: Analyze
    analyze_result = test_analyze(session_id)

    # Test 5: Ask
    test_ask(session_id)

    # Test 6: Correct Category
    test_correct_category()

    # Test 7: LLM Categorization
    test_categorize_llm()

    # Summary
    print(f"\n{BLUE}{'='*60}")
    print(f"✓ Full API workflow test complete!")
    print(f"{'='*60}{RESET}\n")

    print(f"{GREEN}Session ID for reference:{RESET} {session_id}\n")


if __name__ == "__main__":
    main()
