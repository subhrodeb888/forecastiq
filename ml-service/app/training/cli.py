"""Command-line training of demand forecasting models.

Reads sales history from PostgreSQL through the data pipeline, trains a
Random Forest per product, evaluates it on a chronological holdout
(MAE/RMSE/R²), and persists the model (joblib), metrics, and preprocessing
artifacts.

Usage::

    python scripts/train.py --all
    python scripts/train.py <product-id> [<product-id> ...]
    python scripts/train.py --all --test-days 14

Exit codes: 0 = every product trained, 1 = at least one failure, 2 = usage.
"""

import argparse
import logging
from collections.abc import Sequence

from app.core.config import get_settings
from app.core.exceptions import AppError
from app.core.logging import configure_logging
from app.training.service import TrainingService

logger = logging.getLogger(__name__)


def build_parser() -> argparse.ArgumentParser:
    """CLI argument definitions."""
    parser = argparse.ArgumentParser(
        prog="train",
        description="Train demand forecasting models from PostgreSQL sales history.",
    )
    parser.add_argument(
        "product_ids",
        nargs="*",
        metavar="PRODUCT_ID",
        help="products to train; mutually exclusive with --all",
    )
    parser.add_argument(
        "--all",
        action="store_true",
        help="train every product that has sales history",
    )
    parser.add_argument(
        "--test-days",
        type=int,
        default=None,
        metavar="N",
        help="chronological holdout size in days (overrides the fraction default)",
    )
    parser.add_argument(
        "--test-fraction",
        type=float,
        default=None,
        metavar="F",
        help="chronological holdout share in (0, 1); overrides DEFAULT_TEST_FRACTION",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    """Parse arguments, train the requested products, return the exit code."""
    args = build_parser().parse_args(argv)
    settings = get_settings()
    configure_logging(settings.log_level, settings.use_json_logs)

    if args.all and args.product_ids:
        logger.error("pass product ids or --all, not both")
        return 2
    if not args.all and not args.product_ids:
        logger.error("nothing to train; pass product ids or --all")
        return 2

    service = TrainingService.from_settings(settings)
    if args.all:
        try:
            product_ids = service.list_trainable_products()
        except AppError as exc:
            logger.error("could not list trainable products: %s", exc.message)
            return 1
        if not product_ids:
            logger.error("no products with sales history found")
            return 1
    else:
        product_ids = args.product_ids

    logger.info(
        "training %d product(s); artifacts under %s",
        len(product_ids),
        settings.model_artifacts_dir,
    )
    failures = 0
    for product_id in product_ids:
        try:
            result = service.train_product(
                product_id,
                test_days=args.test_days,
                test_fraction=args.test_fraction,
            )
        except AppError as exc:
            failures += 1
            logger.error(
                "training failed for %s: %s (%s)", product_id, exc.message, exc.details
            )
            continue
        metrics = result.metrics
        logger.info(
            "trained %s: mae=%.3f rmse=%.3f r2=%.3f -> %s",
            product_id,
            metrics.mae,
            metrics.rmse,
            metrics.r2,
            result.artifacts.model,
        )

    logger.info("done: %d/%d products trained", len(product_ids) - failures, len(product_ids))
    return 1 if failures else 0
