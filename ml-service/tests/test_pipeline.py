"""Unit tests for the data loading and preprocessing pipeline.

The database is not touched: ``SalesDataLoader`` query construction and error
wrapping are tested directly, and the service is exercised with an in-memory
loader stub.
"""

from datetime import date, timedelta
from typing import Any

import numpy as np
import pandas as pd
import pytest
from sqlalchemy import create_engine

from app.core.config import Settings
from app.core.exceptions import DataLoadingError, EmptySalesHistoryError, ValidationError
from app.pipeline.cleaning import aggregate_daily, clean_daily_sales
from app.pipeline.features import DEFAULT_FEATURE_SPEC, build_features
from app.pipeline.loader import SalesDataLoader
from app.pipeline.preprocessing import reindex_daily_sales, to_records, train_test_split
from app.pipeline.schemas import DAILY_COLUMNS
from app.pipeline.service import DataPipelineService
from app.utils.series import to_daily_series
from tests.conftest import PRODUCT_ID, StubLoader, make_daily_frame, make_line_items

PRODUCT = PRODUCT_ID
START = date(2026, 1, 1)


# ---------------------------------------------------------------------------
# Loader
# ---------------------------------------------------------------------------


def test_loader_builds_filtered_query() -> None:
    sql, params = SalesDataLoader._build_query(
        product_id=PRODUCT, start_date=date(2026, 1, 1), end_date=date(2026, 2, 1)
    )
    assert 'si."productId" = CAST(:product_id AS uuid)' in sql
    assert 's."saleDate"::date >= :start_date' in sql
    assert 's."saleDate"::date <= :end_date' in sql
    assert params == {
        "product_id": PRODUCT,
        "start_date": "2026-01-01",
        "end_date": "2026-02-01",
    }


def test_loader_builds_unfiltered_query() -> None:
    sql, params = SalesDataLoader._build_query()
    assert ":product_id" not in sql
    assert ":start_date" not in sql
    assert params == {}


def test_loader_wraps_database_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    engine = create_engine("postgresql+psycopg://postgres@localhost:5432/forecastiq")
    loader = SalesDataLoader(engine)

    def boom(*_args: Any, **_kwargs: Any) -> pd.DataFrame:
        raise RuntimeError("connection refused")

    monkeypatch.setattr("app.pipeline.loader.pd.read_sql_query", boom)
    with pytest.raises(DataLoadingError, match="failed to load sales history"):
        loader.load_line_items(product_id=PRODUCT)


# ---------------------------------------------------------------------------
# Aggregation & cleaning
# ---------------------------------------------------------------------------


def test_aggregate_daily_sums_duplicate_days() -> None:
    frame = make_line_items([1.0, 2.0])
    duplicated = pd.concat([frame, frame.iloc[[0]]], ignore_index=True)
    daily = aggregate_daily(duplicated)
    assert len(daily) == 2
    assert daily["quantity"].tolist() == [2.0, 2.0]


def test_aggregate_daily_empty() -> None:
    daily = aggregate_daily(pd.DataFrame(columns=DAILY_COLUMNS))
    assert daily.empty
    assert list(daily.columns) == DAILY_COLUMNS


def test_clean_drops_invalid_rows() -> None:
    frame = pd.DataFrame(
        {
            "product_id": [PRODUCT] * 6,
            "sale_date": [
                date(2026, 1, 1),
                date(2026, 1, 2),
                date(2026, 1, 3),
                date(2026, 1, 4),
                date(2026, 1, 5),
                date(2099, 1, 1),  # future-dated ledger mistake
            ],
            "quantity": [5.0, -1.0, 0.0, 7.0, None, 3.0],
        }
    )

    daily, report = clean_daily_sales(frame, today=date(2026, 1, 10))

    assert daily["quantity"].tolist() == [5.0, 7.0]
    assert report.rows_in == 6
    assert report.invalid_rows_dropped == 1
    assert report.non_positive_quantities_dropped == 2
    assert report.future_dates_dropped == 1
    assert report.duplicate_days_merged == 0
    assert report.rows_out == 2


def test_clean_clips_extreme_outliers() -> None:
    quantities = [8.0, 9.0, 10.0, 11.0, 12.0] * 6  # Q1=9, Q3=11, IQR=2
    quantities[15] = 500.0
    daily, report = clean_daily_sales(make_line_items(quantities), today=date(2026, 3, 1))
    assert report.outliers_clipped == 1
    assert daily["quantity"].max() == 11.0 + 3.0 * 2.0  # winsorized at the fence


def test_clean_leaves_short_or_constant_series_untouched() -> None:
    daily, report = clean_daily_sales(
        make_line_items([10.0] * 6), today=date(2026, 2, 1)
    )
    assert report.outliers_clipped == 0
    assert daily["quantity"].tolist() == [10.0] * 6


def test_clean_empty_frame() -> None:
    daily, report = clean_daily_sales(pd.DataFrame(columns=DAILY_COLUMNS))
    assert daily.empty
    assert report.rows_in == 0
    assert report.rows_out == 0


# ---------------------------------------------------------------------------
# Reindexing & records
# ---------------------------------------------------------------------------


def test_reindex_fills_missing_days_with_zero() -> None:
    frame = make_daily_frame([4.0, 2.0]).drop(index=1)
    gap = pd.DataFrame(
        {"product_id": [PRODUCT], "sale_date": [pd.Timestamp("2026-01-03")], "quantity": [6.0]}
    )
    reindexed = reindex_daily_sales(pd.concat([frame, gap], ignore_index=True))
    assert len(reindexed) == 3
    assert reindexed["quantity"].tolist() == [4.0, 0.0, 6.0]
    assert reindexed["sale_date"].tolist() == list(pd.date_range("2026-01-01", periods=3))


def test_reindex_handles_multiple_products() -> None:
    first = make_daily_frame([1.0, 2.0])
    second = make_line_items([9.0]).assign(product_id="other-product")
    second["sale_date"] = pd.to_datetime(second["sale_date"])
    reindexed = reindex_daily_sales(pd.concat([first, second], ignore_index=True))
    assert len(reindexed) == 3
    assert set(reindexed["product_id"]) == {PRODUCT, "other-product"}


def test_to_records_feeds_to_daily_series() -> None:
    daily = reindex_daily_sales(make_daily_frame([4.0, 2.0]))
    values, first_date, last_date = to_daily_series(to_records(daily))
    np.testing.assert_array_equal(values, np.array([4.0, 2.0]))
    assert first_date == START
    assert last_date == START + timedelta(days=1)


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------


def test_build_features_columns_and_warmup() -> None:
    featured = build_features(make_daily_frame([float(i) for i in range(1, 41)]))
    spec = DEFAULT_FEATURE_SPEC
    assert len(featured) == 40 - spec.warmup_periods
    assert list(featured.columns) == DAILY_COLUMNS + spec.feature_columns()
    assert not featured.isna().any().any()


def test_build_features_are_leakage_safe() -> None:
    n = 40
    featured = build_features(make_daily_frame([float(i) for i in range(1, n + 1)]))
    first = featured.iloc[0]
    # Warm-up is 28 rows (largest rolling window), so the first row is day 29.
    assert first["quantity"] == 29.0
    assert first["lag_1"] == 28.0
    assert first["lag_7"] == 22.0
    assert first["lag_14"] == 15.0
    # Rolling stats describe the days *before* the row, never the row itself.
    assert first["rolling_mean_7"] == np.mean([22.0, 23.0, 24.0, 25.0, 26.0, 27.0, 28.0])
    assert first["rolling_mean_28"] == np.mean(np.arange(1.0, 29.0))
    assert first["expanding_mean"] == np.mean(np.arange(1.0, 29.0))


def test_build_features_empty() -> None:
    featured = build_features(pd.DataFrame(columns=DAILY_COLUMNS))
    assert featured.empty
    assert list(featured.columns) == DAILY_COLUMNS + DEFAULT_FEATURE_SPEC.feature_columns()


# ---------------------------------------------------------------------------
# Train/test split
# ---------------------------------------------------------------------------


def test_train_test_split_is_chronological() -> None:
    featured = build_features(make_daily_frame([float(i) for i in range(1, 61)]))
    split = train_test_split(featured, test_days=7)
    assert len(split.test) == 7
    assert len(split.train) == len(featured) - 7
    assert split.train["sale_date"].max() < split.test["sale_date"].min()
    assert split.test_days == 7


def test_train_test_split_fraction_default() -> None:
    featured = build_features(make_daily_frame([float(i) for i in range(1, 61)]))
    split = train_test_split(featured, test_fraction=0.2)
    assert split.test_days == max(1, int(np.ceil(len(featured) * 0.2)))
    assert len(split.test) == split.test_days


def test_train_test_split_rejects_oversized_holdout() -> None:
    featured = build_features(make_daily_frame([float(i) for i in range(1, 36)]))
    with pytest.raises(ValidationError, match="not enough rows"):
        train_test_split(featured, test_days=len(featured), min_train_rows=1)


def test_train_test_split_rejects_empty_frame() -> None:
    with pytest.raises(ValidationError, match="empty dataset"):
        train_test_split(pd.DataFrame(columns=DAILY_COLUMNS))


# ---------------------------------------------------------------------------
# Service orchestration
# ---------------------------------------------------------------------------


def make_service(frame: pd.DataFrame) -> DataPipelineService:
    return DataPipelineService(Settings(), StubLoader(frame))  # type: ignore[arg-type]


def test_prepare_dataset_end_to_end() -> None:
    n = 60
    service = make_service(make_line_items([float(i) for i in range(1, n + 1)]))
    result = service.prepare_dataset(PRODUCT, test_days=7)

    assert result.product_id == PRODUCT
    assert result.series.shape == (n,)
    assert result.first_date == START
    assert result.last_date == START + timedelta(days=n - 1)
    assert result.series.sum() == float(sum(range(1, n + 1)))
    assert len(result.split.test) == 7
    assert len(result.split.train) == len(result.features) - 7
    assert result.cleaning.rows_in == n
    assert result.cleaning.rows_out == n

    expected, _, _ = to_daily_series(to_records(result.daily))
    np.testing.assert_array_equal(result.series, expected)


def test_load_daily_history_zero_fills_gaps() -> None:
    frame = make_line_items([4.0, 2.0]).drop(index=1)
    gap = pd.DataFrame(
        {
            "product_id": [PRODUCT],
            "sale_date": [date(2026, 1, 3)],
            "quantity": [6.0],
        }
    )
    service = make_service(pd.concat([frame, gap], ignore_index=True))
    daily = service.load_daily_history(PRODUCT)
    assert daily["quantity"].tolist() == [4.0, 0.0, 6.0]


def test_prepare_dataset_raises_on_empty_history() -> None:
    service = make_service(pd.DataFrame(columns=DAILY_COLUMNS))
    with pytest.raises(EmptySalesHistoryError, match="no sales history"):
        service.prepare_dataset(PRODUCT)


def test_prepare_dataset_raises_when_cleaning_removes_everything() -> None:
    service = make_service(make_line_items([-1.0, -2.0]))
    with pytest.raises(EmptySalesHistoryError, match="no usable sales rows"):
        service.prepare_dataset(PRODUCT)


def test_prepare_dataset_raises_when_history_too_short_for_features() -> None:
    service = make_service(make_line_items([3.0] * 10))
    with pytest.raises(EmptySalesHistoryError, match="not enough history"):
        service.prepare_dataset(PRODUCT)
