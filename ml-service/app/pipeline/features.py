"""Leakage-safe feature engineering for daily demand series."""

import logging
from dataclasses import dataclass

import numpy as np
import pandas as pd

from app.pipeline.schemas import DAILY_COLUMNS

logger = logging.getLogger(__name__)

TARGET_COLUMN = "quantity"

CALENDAR_COLUMNS: list[str] = [
    "day_of_week",
    "is_weekend",
    "day_of_month",
    "week_of_year",
    "month",
    "dow_sin",
    "dow_cos",
]


@dataclass(frozen=True, slots=True)
class FeatureSpec:
    """Which lag/rolling features to build (calendar features are always on).

    All history-based features are shifted by at least one day, so every
    predictor is knowable at forecast time — no target leakage.
    """

    lags: tuple[int, ...] = (1, 7, 14)
    rolling_windows: tuple[int, ...] = (7, 14, 28)

    def __post_init__(self) -> None:
        if not self.lags or min(self.lags) < 1:
            raise ValueError("lags must be positive integers")
        if not self.rolling_windows or min(self.rolling_windows) < 2:
            raise ValueError("rolling windows must be integers >= 2")

    @property
    def warmup_periods(self) -> int:
        """Leading rows dropped per product (insufficient history for features).

        A lag of ``n`` first yields a value at row ``n``; a rolling window of
        ``w`` over the shift(1) history first yields a full window at row
        ``w`` — so the largest of the two bounds the warm-up.
        """
        return max(max(self.lags), max(self.rolling_windows))

    def feature_columns(self) -> list[str]:
        """Predictor column names, in the order ``build_features`` emits them."""
        columns = list(CALENDAR_COLUMNS)
        columns += [f"lag_{lag}" for lag in self.lags]
        for window in self.rolling_windows:
            columns += [f"rolling_mean_{window}", f"rolling_std_{window}"]
        columns.append("expanding_mean")
        return columns


DEFAULT_FEATURE_SPEC = FeatureSpec()


def build_features(daily: pd.DataFrame, spec: FeatureSpec = DEFAULT_FEATURE_SPEC) -> pd.DataFrame:
    """Engineer forecasting features from a gap-free daily frame.

    Expects the output of ``reindex_daily_sales`` (one row per product and
    calendar day). Returns one row per product/day with calendar, lag,
    rolling, and expanding predictors plus the ``quantity`` target. The
    per-product warm-up rows (the first ``spec.warmup_periods`` days) are
    dropped because their lag/rolling values would be incomplete.
    """
    if daily.empty:
        return pd.DataFrame(columns=DAILY_COLUMNS + spec.feature_columns())
    frames = [
        _product_features(group.sort_values("sale_date"), spec)
        for _, group in daily.groupby("product_id", sort=True)
    ]
    featured = pd.concat(frames, ignore_index=True)
    return featured.dropna().reset_index(drop=True)


def _product_features(group: pd.DataFrame, spec: FeatureSpec) -> pd.DataFrame:
    """Build features for a single product's sorted daily frame."""
    frame = group.copy()
    quantity = frame[TARGET_COLUMN]

    # Calendar features — knowable for any future date.
    frame["day_of_week"] = frame["sale_date"].dt.dayofweek
    frame["is_weekend"] = (frame["day_of_week"] >= 5).astype(int)
    frame["day_of_month"] = frame["sale_date"].dt.day
    frame["week_of_year"] = frame["sale_date"].dt.isocalendar().week.astype(int)
    frame["month"] = frame["sale_date"].dt.month
    radians = 2.0 * np.pi * frame["day_of_week"] / 7.0
    frame["dow_sin"] = np.sin(radians)
    frame["dow_cos"] = np.cos(radians)

    # Lagged demand.
    for lag in spec.lags:
        frame[f"lag_{lag}"] = quantity.shift(lag)

    # Rolling/expanding statistics of the days *before* each row — the
    # shift(1) keeps the current day's demand out of its own predictors.
    history = quantity.shift(1)
    for window in spec.rolling_windows:
        rolling = history.rolling(window, min_periods=window)
        frame[f"rolling_mean_{window}"] = rolling.mean()
        frame[f"rolling_std_{window}"] = rolling.std()
    frame["expanding_mean"] = history.expanding(min_periods=1).mean()

    return frame
