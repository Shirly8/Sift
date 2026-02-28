"""
End-to-End API Integration Test

Tests the full workflow:
1. Health check
2. Upload CSV → get session_id
3. Analyze with session_id
4. Ask a question
5. Correct a category

Run this AFTER starting the Flask app:
  python3 app.py
  # Then in another terminal:
  python3 tests/test_api_integration.py
"""

import os
import sys
import requests
import json
from pathlib import Path

API_BASE = "http://localhost:5001"
CSV_PATH = os.path.join(os.path.dirname(__file__), "../Data/wealthsimple_demo.csv")

GREEN  = '\033[92m'
RED    = '\033[91m'
YELLOW = '\033[93m'
BLUE   = '\033[94m'
RESET  = '\033[0m'


def log_test(name):
    print(f"\n{BLUE}▶ {name}{RESET}")

def log_success(msg):
    print(f"{GREEN}✓ {msg}{RESET}")

def log_error(msg):
    print(f"{RED}✗ {msg}{RESET}")

def log_info(msg):
    print(f"  {YELLOW}→{RESET} {msg}")



####################################
# STEP 1: HEALTH CHECK
####################################

def test_health_check():
    log_test("Health Check")

    try:
        res = requests.get(f"{API_BASE}/api/health-check")
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        assert data.get("status") == "ok"

        log_success("API is healthy")
        return True
    except Exception as e:
        log_error(f"Health check failed: {e}")
        return False



####################################
# STEP 2: UPLOAD
####################################

def test_upload():
    log_test("Upload CSV")

    if not os.path.exists(CSV_PATH):
        log_error(f"CSV not found at {CSV_PATH}")
        return None

    try:
        with open(CSV_PATH, 'rb') as f:
            res = requests.post(f"{API_BASE}/api/upload", files={'file': f})

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        assert data.get("status") == "success"
        assert "session_id" in data

        session_id = data["session_id"]
        summary    = data.get("summary", {})

        log_success(f"Session ID: {session_id}")
        log_info(f"Total transactions: {summary.get('total')}")
        log_info(f"Categorized: {summary.get('categorized')} ({summary.get('coverage_pct')}%)")
        log_info(f"Needs LLM: {summary.get('needs_llm')}")
        log_info(f"Date range: {summary.get('date_range', {}).get('start')} → {summary.get('date_range', {}).get('end')}")

        return {"session_id": session_id, "data": data}

    except Exception as e:
        log_error(f"Upload failed: {e}")
        return None



####################################
# STEP 3: ANALYZE
####################################

def test_analyze(session_id):
    log_test("Run Analysis")

    if not session_id:
        log_error("No session_id provided")
        return None

    try:
        res = requests.post(f"{API_BASE}/api/analyze", json={"session_id": session_id})
        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()
        assert "profile" in data or "tools_run" in data or "insights" in data

        log_success("Analysis complete")

        if "tools_run" in data:
            log_info(f"Tools executed: {len(data['tools_run'])}")
            for tool in data["tools_run"]:
                name = tool.get("name", tool) if isinstance(tool, dict) else tool
                log_info(f"  - {name}")

        if "insights" in data:
            log_info(f"Insights: {len(data['insights'])}")
            for insight in data["insights"][:2]:
                log_info(f"  - {insight.get('title', '')}")

        return data

    except Exception as e:
        log_error(f"Analysis failed: {e}")
        return None



####################################
# STEP 4: ASK
####################################

def test_ask(session_id):
    log_test("Ask Question")

    if not session_id:
        log_error("No session_id provided")
        return None

    question = "What are my top spending categories?"

    try:
        res = requests.post(
            f"{API_BASE}/api/ask",
            json={"session_id": session_id, "question": question},
        )

        assert res.status_code == 200, f"Expected 200, got {res.status_code}"

        data = res.json()

        log_success("Question answered")
        log_info(f"Question: {question}")

        if "answer" in data:
            log_info(f"Answer: {data['answer'][:200]}...")
        if "tool_used" in data:
            log_info(f"Tool used: {data['tool_used']}")

        return data

    except Exception as e:
        log_error(f"Ask failed: {e}")
        return None



####################################
# STEP 5: CORRECT CATEGORY
####################################

def test_correct_category():
    log_test("Correct Category (User Learning)")

    try:
        res = requests.post(
            f"{API_BASE}/api/correct-category",
            json={"merchant": "MYSTERY SHOP", "category": "Shopping"},
        )

        assert res.status_code == 200

        data = res.json()
        assert data.get("status") == "learned"

        log_success("Learned: MYSTERY SHOP → Shopping")
        return True

    except Exception as e:
        log_error(f"Category correction failed: {e}")
        return False



####################################
# ENTRY POINT
####################################

def main():
    print(f"\n{BLUE}{'='*60}")
    print(f"API Integration Test Suite")
    print(f"{'='*60}{RESET}")
    print(f"Target: {API_BASE}")
    print(f"CSV: {CSV_PATH}")

    if not test_health_check():
        print(f"\n{RED}API is not responding. Start the Flask app first:{RESET}")
        print(f"  python3 app.py")
        return

    upload_result = test_upload()
    if not upload_result:
        print(f"\n{RED}Upload failed. Cannot continue.{RESET}")
        return

    session_id = upload_result["session_id"]

    test_analyze(session_id)
    test_ask(session_id)
    test_correct_category()

    print(f"\n{BLUE}{'='*60}")
    print(f"✓ Full API workflow test complete!")
    print(f"{'='*60}{RESET}\n")

    print(f"{GREEN}Session ID for reference:{RESET} {session_id}\n")


if __name__ == "__main__":
    main()
