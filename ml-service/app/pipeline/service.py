"""Reusable, end-to-end data loading and preprocessing pipeline."""

import logging
from datetime import date
from uuid import UUID

import pandas as pd
from sqlalchemy import Engine

from app.core.config import Settings
from app.core.database import get_engine
from app.core.exceptions import EmptySalesHistoryError
from app.pipeline.cleaning import clean_daily_sales
from app.pipeline.features import DEFAULT_FEATURE_SPEC, FeatureSpec, build_features
from app.pipeline.loader import SalesDataLoader
from app.pipeline.preprocessing import reindex_daily_sales, to_records, train_test_split
from app.pipeline.schemas import CleaningReport, PipelineResult
from app.utils.series import to_daily_series

logger = logging.getLogger(__name__)


class DataPipelineService:
    """Turns raw PostgreSQL sales into model-ready datasets.

    Stage order: load line items → clean/validate → aggregate daily per
    product → reindex onto a gap-free calendar (zero-filled) → truncate to
    the configured history window → engineer leakage-safe features →
    chronological train/test split. Each stage is also usable standalone via
    the functions in :mod:`app.pipeline.cleaning`,
    :mod:`app.pipeline.preprocessing`, and :mod:`app.pipeline.features`.
    """

    def __init__(self, settings: Settings, loader: SalesDataLoader) -> None:
        self._settings = settings
        self._loader = loader

    @classmethod
    def from_settings(
        cls, settings: Settings, engine: Engine | None = None
    ) -> "DataPipelineService":
        """Build a service wired to the given (or shared) database engine."""
        return cls(settings, SalesDataLoader(engine or get_engine()))

    def list_products(self) -> list[str]:
        """Product ids that have at least one recorded sale line item."""
        return self._loader.load_product_ids()

    def load_daily_history(
        self,
        product_id: UUID | str,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> pd.DataFrame:
        """Gap-free daily demand for one product: cleaned, zero-filled.

        Raises :class:`EmptySalesHistoryError` when the product has no sales
        rows, or none survive cleaning.
        """
        daily, _ = self._prepare_daily(product_id, start_date=start_date, end_date=end_date)
        return daily

    def prepare_dataset(
        self,
        product_id: UUID | str,
        *,
        test_days: int | None = None,
        test_fraction: float | None = None,
        feature_spec: FeatureSpec = DEFAULT_FEATURE_SPEC,
    ) -> PipelineResult:
        """Run the full pipeline for one product.

        Returns the cleaned daily frame, the engineered feature frame, a
        chronological train/test split, the zero-filled demand series, and
        the cleaning report — see :class:`PipelineResult`.
        """
        settings = self._settings
        daily, report = self._prepare_daily(product_id)

        features = build_features(daily, feature_spec)
        if features.empty:
            raise EmptySalesHistoryError(
                "not enough history to engineer features",
                details={
                    "product_id": str(product_id),
                    "daily_rows": len(daily),
                    "warmup_periods": feature_spec.warmup_periods,
                },
            )

        split = train_test_split(
            features,
            test_days=test_days,
            test_fraction=test_fraction or settings.default_test_fraction,
            min_train_rows=settings.min_history_points,
        )

        values, first_date, last_date = to_daily_series(to_records(daily))
        logger.info(
            "dataset prepared: product=%s days=%d train=%d test=%d cleaning=%s",
            product_id,
            len(daily),
            len(split.train),
            len(split.test),
            report.as_dict(),
        )
        return PipelineResult(
            product_id=str(product_id),
            daily=daily,
            features=features,
            split=split,
            series=values,
            first_date=first_date,
            last_date=last_date,
            cleaning=report,
        )

    def _prepare_daily(
        self,
        product_id: UUID | str,
        *,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> tuple[pd.DataFrame, CleaningReport]:
        """Load, clean, aggregate, reindex, and truncate one product."""
        raw = self._loader.load_line_items(
            product_id=str(product_id), start_date=start_date, end_date=end_date
        )
        if raw.empty:
            raise EmptySalesHistoryError(
                "no sales history found", details={"product_id": str(product_id)}
            )
        daily, report = clean_daily_sales(
            raw, outlier_iqr_multiplier=self._settings.outlier_iqr_multiplier
        )
        if daily.empty:
            raise EmptySalesHistoryError(
                "no usable sales rows remain after cleaning",
                details={"product_id": str(product_id), **report.as_dict()},
            )
        return self._truncate(reindex_daily_sales(daily)), report

    def _truncate(self, daily: pd.DataFrame) -> pd.DataFrame:
        """Keep only the most recent ``max_history_points`` days per product."""
        limit = self._settings.max_history_points
        cutoff = daily["sale_date"].max() - pd.Timedelta(days=limit - 1)
        truncated = daily.loc[daily["sale_date"] >= cutoff].reset_index(drop=True)
        dropped = len(daily) - len(truncated)
        if dropped:
            logger.info(
                "history truncated to the most recent %d days (%d rows dropped)",
                limit,
                dropped,
            )
        return truncated
