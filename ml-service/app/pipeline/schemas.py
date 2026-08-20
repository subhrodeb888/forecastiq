"""Internal data structures passed between pipeline stages.

These are plain dataclasses, not API contracts (those live in
``app.schemas``), so pipeline code stays free of serialization concerns.
"""

from dataclasses import dataclass
from datetime import date

import numpy as np
import pandas as pd

# Canonical column order for every daily-grain frame in the pipeline.
DAILY_COLUMNS: list[str] = ["product_id", "sale_date", "quantity"]


@dataclass(frozen=True, slots=True)
class DailySalesRecord:
    """One product's aggregated demand for a single calendar day.

    Satisfies the :class:`app.utils.series.DatedQuantity` protocol, so a list
    of records feeds straight into ``to_daily_series``.
    """

    product_id: str
    date: date
    quantity: float


@dataclass(frozen=True, slots=True)
class CleaningReport:
    """Row-level accounting of every cleaning decision."""

    rows_in: int = 0
    rows_out: int = 0
    invalid_rows_dropped: int = 0
    non_positive_quantities_dropped: int = 0
    future_dates_dropped: int = 0
    duplicate_days_merged: int = 0
    outliers_clipped: int = 0

    def as_dict(self) -> dict[str, int]:
        """Plain-dict view for logs and error details."""
        return {
            "rows_in": self.rows_in,
            "rows_out": self.rows_out,
            "invalid_rows_dropped": self.invalid_rows_dropped,
            "non_positive_quantities_dropped": self.non_positive_quantities_dropped,
            "future_dates_dropped": self.future_dates_dropped,
            "duplicate_days_merged": self.duplicate_days_merged,
            "outliers_clipped": self.outliers_clipped,
        }


@dataclass(frozen=True, slots=True)
class DatasetSplit:
    """Chronological train/test partition of a feature frame.

    ``test_days`` is the per-product holdout size; when the split was derived
    from a fraction across several products it reports the largest holdout.
    """

    train: pd.DataFrame
    test: pd.DataFrame
    test_days: int


@dataclass(frozen=True, slots=True)
class PipelineResult:
    """Everything a model trainer needs for one product.

    ``daily`` is the gap-free, cleaned daily frame; ``features`` adds the
    engineered predictors (warm-up rows dropped); ``series`` is the same
    demand as a zero-filled numpy array aligned with ``first_date``, matching
    :func:`app.utils.series.to_daily_series` semantics.
    """

    product_id: str
    daily: pd.DataFrame
    features: pd.DataFrame
    split: DatasetSplit
    series: np.ndarray
    first_date: date
    last_date: date
    cleaning: CleaningReport
