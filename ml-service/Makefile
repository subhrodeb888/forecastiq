.PHONY: setup setup-dev dev start train test lint clean

VENV := .venv
PY := $(VENV)/bin/python

setup:
	bash scripts/setup.sh

setup-dev:
	bash scripts/setup.sh --dev

dev:
	ENVIRONMENT=development $(VENV)/bin/uvicorn main:app --reload --host 0.0.0.0 --port $${PORT:-8000}

start:
	$(PY) main.py

# e.g. make train ARGS="--all" or ARGS="<product-id> --test-days 14"
train:
	$(PY) scripts/train.py $(ARGS)

test:
	$(VENV)/bin/pytest

lint:
	$(VENV)/bin/ruff check .

clean:
	rm -rf $(VENV) .pytest_cache .ruff_cache
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
