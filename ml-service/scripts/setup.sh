#!/usr/bin/env bash
# Create the virtual environment and install dependencies.
# Usage: scripts/setup.sh [--dev]
set -euo pipefail

cd "$(dirname "$0")/.."

PYTHON_BIN="${PYTHON_BIN:-python3}"

if [ ! -d ".venv" ]; then
  echo "Creating virtual environment in .venv ..."
  "$PYTHON_BIN" -m venv .venv
fi

echo "Upgrading pip ..."
.venv/bin/pip install --quiet --upgrade pip

if [ "${1:-}" = "--dev" ]; then
  echo "Installing runtime + development dependencies ..."
  .venv/bin/pip install -r requirements-dev.txt
else
  echo "Installing runtime dependencies ..."
  .venv/bin/pip install -r requirements.txt
fi

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example — review and adjust as needed."
fi

echo "Done. Activate with: source .venv/bin/activate"
