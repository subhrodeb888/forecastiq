"""Gap-filling reindexation, record conversion, and chronological splitting."""

import logging
import math

import pandas as pd

from app.core.exceptions import ValidationError
from app.pipeline.schemas import DAILY_COLUMNS, DailySalesRecord, DatasetSplit

logger = logging.getLogger(__name__)


def reindex_daily_sales(daily: pd.DataFrame) -> pd.DataFrame:
    """Reindex each product onto a gap-free daily calendar.

    Days without a recorded sale become explicit zero-demand rows — the same
    convention as :func:`app.utils.series.to_daily_series` and the ForecastIQ
    sales ledger. The observed per-product date range is preserved; the
    calendar is never extended beyond it.
    """
    if daily.empty:
        return pd.DataFrame(columns=DAILY_COLUMNS)
    daily = daily.copy()
    daily["sale_date"] = pd.to_datetime(daily["sale_date"])
    frames: list[pd.DataFrame] = []
    for product_id, group in daily.groupby("product_id", sort=True):
        group = group.sort_values("sale_date")
        calendar = pd.date_range(group["sale_date"].min(), group["sale_date"].max(), freq="D")
        reindexed = group.set_index("sale_date").reindex(calendar)
        reindexed["product_id"] = str(product_id)
        reindexed["quantity"] = reindexed["quantity"].fillna(0.0)
        reindexed.index.name = "sale_date"
        frames.append(reindexed.reset_index()[DAILY_COLUMNS])
    return pd.concat(frames, ignore_index=True)


def to_records(daily: pd.DataFrame) -> list[DailySalesRecord]:
    """Convert a daily frame into records understood by ``to_daily_series``."""
    return [
        DailySalesRecord(
            product_id=str(row.product_id),
            date=row.sale_date.date(),
            quantity=float(row.quantity),
        )
        for row in daily.itertuples(index=False)
    ]


def train_test_split(
    frame: pd.DataFrame,
    *,
    test_days: int | None = None,
    test_fraction: float = 0.2,
    min_train_rows: int = 8,
) -> DatasetSplit:
    """Split a feature frame chronologically into train and test partitions.

    The split is per product: for each product the most recent ``test_days``
    rows (or ``test_fraction`` of its rows, rounded up) form the test set.
    Time-based — never shuffled — so evaluation mirrors real forecasting.
    """
    if frame.empty:
        raise ValidationError("cannot split an empty dataset")
    if test_days is not None and test_days < 1:
        raise ValidationError("test_days must be at least 1", details={"received": test_days})
    if not 0.0 < test_fraction < 1.0:
        raise ValidationError(
            "test_fraction must be in (0, 1)", details={"received": test_fraction}
        )

    trains: list[pd.DataFrame] = []
    tests: list[pd.DataFrame] = []
    largest_holdout = 0
    for product_id, group in frame.groupby("product_id", sort=True):
        group = group.sort_values("sale_date")
        holdout = (
            test_days if test_days is not None else max(1, math.ceil(len(group) * test_fraction))
        )
        if len(group) - holdout < min_train_rows:
            raise ValidationError(
                "not enough rows to hold out a test set",
                details={
                    "product_id": str(product_id),
                    "rows": len(group),
                    "test_rows": holdout,
                    "min_train_rows": min_train_rows,
                },
            )
        largest_holdout = max(largest_holdout, holdout)
        trains.append(group.iloc[:-holdout])
        tests.append(group.iloc[-holdout:])

    return DatasetSplit(
        train=pd.concat(trains, ignore_index=True),
        test=pd.concat(tests, ignore_index=True),
        test_days=largest_holdout,
    )
