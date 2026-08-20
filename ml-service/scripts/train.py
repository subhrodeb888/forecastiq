#!/usr/bin/env python3
"""Train demand forecasting models from PostgreSQL sales history.

Thin wrapper around :func:`app.training.cli.main` so the command runs from
any working directory:

    python scripts/train.py --all
    python scripts/train.py <product-id> --test-days 14
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.training.cli import main  # noqa: E402

if __name__ == "__main__":
    raise SystemExit(main())
