#!/bin/bash

# ─────────────────────────────────────────
#  Sift — starts backend + frontend together
#  Usage: ./start.sh
# ─────────────────────────────────────────

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/backend" && pwd)"
FRONTEND_DIR="$(cd "$(dirname "$0")/frontend" && pwd)"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cleanup() {
  echo ""
  echo "Shutting down..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
  exit 0
}
trap cleanup SIGINT SIGTERM

# ── 1. Check .env ──────────────────────────────────────────
if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo -e "${YELLOW}No .env found. Creating from .env.example...${NC}"
  cp "$BACKEND_DIR/.env.example" "$BACKEND_DIR/.env" 2>/dev/null || \
    echo "ANTHROPIC_API_KEY=" > "$BACKEND_DIR/.env"
  echo -e "${YELLOW}Add your API key to backend/.env and re-run.${NC}"
  exit 1
fi

# ── 2. Backend dependencies ────────────────────────────────
echo -e "${GREEN}Installing backend dependencies...${NC}"
cd "$BACKEND_DIR"
if [ -d "venv" ]; then
  source venv/bin/activate
else
  python3 -m venv venv
  source venv/bin/activate
  pip install -q -r requirements.txt
fi

# ── 3. Frontend dependencies ───────────────────────────────
echo -e "${GREEN}Installing frontend dependencies...${NC}"
cd "$FRONTEND_DIR"
if [ ! -d "node_modules" ]; then
  npm install --silent
fi

# ── 4. Start backend ───────────────────────────────────────
echo -e "${GREEN}Starting backend on http://localhost:5001${NC}"
cd "$BACKEND_DIR"
source venv/bin/activate
python app.py &
BACKEND_PID=$!

# ── 5. Start frontend ──────────────────────────────────────
echo -e "${GREEN}Starting frontend on http://localhost:3000${NC}"
cd "$FRONTEND_DIR"
npm run dev &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✓ Sift is running${NC}"
echo "  Frontend → http://localhost:3000"
echo "  Backend  → http://localhost:5001"
echo ""

wait
