"""Validation and cleaning of raw sales line items."""

import logging
from datetime import date

import pandas as pd

from app.pipeline.schemas import DAILY_COLUMNS, CleaningReport

logger = logging.getLogger(__name__)

# Groups shorter than this keep their extreme values: the IQR fence is not
# meaningful on a handful of observations.
_MIN_ROWS_FOR_OUTLIER_DETECTION = 8


def aggregate_daily(frame: pd.DataFrame) -> pd.DataFrame:
    """Aggregate line items to daily sales per product.

    Multiple rows for the same product and calendar day (separate sale
    events, or a duplicated feed) are summed into a single observation.
    """
    if frame.empty:
        return pd.DataFrame(columns=DAILY_COLUMNS)
    return frame.groupby(["product_id", "sale_date"], as_index=False, sort=True)[
        "quantity"
    ].sum()


def clean_daily_sales(
    frame: pd.DataFrame,
    *,
    today: date | None = None,
    outlier_iqr_multiplier: float = 3.0,
) -> tuple[pd.DataFrame, CleaningReport]:
    """Clean raw line items and aggregate them to a daily grain per product.

    Steps, in order, each counted in the returned :class:`CleaningReport`:

    1. coerce types; drop rows with unparseable dates or non-numeric quantity
    2. drop non-positive quantities (voids/returns are not demand)
    3. drop rows dated in the future (ledger mistakes)
    4. aggregate duplicate product/day rows into one daily total
    5. winsorize extreme daily totals per product (IQR fence)
    """
    today = today or date.today()
    if frame.empty:
        return pd.DataFrame(columns=DAILY_COLUMNS), CleaningReport()
    rows_in = len(frame)

    cleaned = frame.copy()
    cleaned["product_id"] = cleaned["product_id"].astype(str)
    cleaned["sale_date"] = pd.to_datetime(cleaned["sale_date"], errors="coerce")
    cleaned["quantity"] = pd.to_numeric(cleaned["quantity"], errors="coerce")

    invalid_mask = cleaned["sale_date"].isna() | cleaned["quantity"].isna()
    invalid_dropped = int(invalid_mask.sum())
    cleaned = cleaned.loc[~invalid_mask]

    positive_mask = cleaned["quantity"] > 0
    non_positive_dropped = int((~positive_mask).sum())
    cleaned = cleaned.loc[positive_mask]

    future_mask = cleaned["sale_date"] > pd.Timestamp(today)
    future_dropped = int(future_mask.sum())
    cleaned = cleaned.loc[~future_mask]

    daily = aggregate_daily(cleaned)
    duplicates_merged = len(cleaned) - len(daily)

    daily, outliers_clipped = _clip_outliers(daily, multiplier=outlier_iqr_multiplier)

    report = CleaningReport(
        rows_in=rows_in,
        rows_out=len(daily),
        invalid_rows_dropped=invalid_dropped,
        non_positive_quantities_dropped=non_positive_dropped,
        future_dates_dropped=future_dropped,
        duplicate_days_merged=duplicates_merged,
        outliers_clipped=outliers_clipped,
    )
    logger.info("sales history cleaned: %s", report.as_dict())
    return daily.reset_index(drop=True), report


def _clip_outliers(frame: pd.DataFrame, *, multiplier: float) -> tuple[pd.DataFrame, int]:
    """Winsorize daily totals outside the IQR fence, per product.

    A multiplier of 3.0 targets only extreme outliers (Tukey's "far out"
    fence). Groups with very few observations or zero IQR are left untouched
    to avoid mangling short or constant series.
    """
    if frame.empty:
        return frame, 0
    clipped_total = 0
    frames: list[pd.DataFrame] = []
    for _, group in frame.groupby("product_id", sort=False):
        if len(group) < _MIN_ROWS_FOR_OUTLIER_DETECTION:
            frames.append(group)
            continue
        q1 = float(group["quantity"].quantile(0.25))
        q3 = float(group["quantity"].quantile(0.75))
        iqr = q3 - q1
        if iqr <= 0:
            frames.append(group)
            continue
        lower = max(0.0, q1 - multiplier * iqr)
        upper = q3 + multiplier * iqr
        outlier_mask = (group["quantity"] < lower) | (group["quantity"] > upper)
        clipped = int(outlier_mask.sum())
        if clipped:
            group = group.copy()
            group.loc[outlier_mask, "quantity"] = group.loc[outlier_mask, "quantity"].clip(
                lower, upper
            )
            clipped_total += clipped
        frames.append(group)
    return pd.concat(frames, ignore_index=True), clipped_total
