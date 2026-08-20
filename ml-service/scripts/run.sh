#!/usr/bin/env bash
# Run the service from the virtual environment.
# Usage: scripts/run.sh [--dev]
#   --dev   auto-reload development server (uvicorn)
#   (none)  settings-driven server honoring HOST/PORT/DEBUG env vars
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -x ".venv/bin/python" ]; then
  echo "Virtual environment not found — run scripts/setup.sh first." >&2
  exit 1
fi

if [ "${1:-}" = "--dev" ]; then
  exec .venv/bin/uvicorn main:app --reload --host 0.0.0.0 --port "${PORT:-8000}"
fi

exec .venv/bin/python main.py
