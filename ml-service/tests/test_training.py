"""Tests for training, holdout evaluation, artifact persistence, and the CLI.

The database is not touched: the training service is exercised with the
in-memory loader stub, and the CLI is tested with a stubbed service factory.
"""

import json
from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace

import joblib
import numpy as np
import pandas as pd
import pytest

from app.core.config import Settings
from app.core.exceptions import EmptySalesHistoryError, ModelNotFoundError, ModelTrainingError
from app.pipeline.features import DEFAULT_FEATURE_SPEC, build_features
from app.pipeline.preprocessing import train_test_split
from app.training.artifacts import ModelArtifactStore
from app.training.cli import main as cli_main
from app.training.schemas import ArtifactPaths, TrainingMetrics, TrainingResult
from app.training.trainer import DemandModelTrainer
from app.utils.metrics import r2_score, root_mean_squared_error
from tests.conftest import (
    PRODUCT_ID,
    make_daily_frame,
    make_line_items,
    make_training_service,
    seasonal_quantities,
)

# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------


def test_root_mean_squared_error() -> None:
    actual = np.array([3.0, -0.5, 2.0, 7.0])
    predicted = np.array([2.5, 0.0, 2.0, 8.0])
    expected = float(np.sqrt(np.mean((actual - predicted) ** 2)))
    assert root_mean_squared_error(actual, predicted) == pytest.approx(expected)
    assert root_mean_squared_error(actual, actual) == 0.0


def test_r2_score() -> None:
    actual = np.array([1.0, 2.0, 3.0, 4.0])
    assert r2_score(actual, actual) == pytest.approx(1.0)
    assert r2_score(actual, np.full(4, 2.5)) == pytest.approx(0.0)
    assert r2_score(actual, np.array([4.0, 3.0, 2.0, 1.0])) < 0.0


def test_r2_score_constant_series() -> None:
    constant = np.full(3, 2.0)
    assert r2_score(constant, constant) == 1.0
    assert r2_score(constant, np.array([1.0, 2.0, 3.0])) == 0.0


# ---------------------------------------------------------------------------
# Trainer
# ---------------------------------------------------------------------------


def test_trainer_produces_holdout_metrics() -> None:
    features = build_features(make_daily_frame(seasonal_quantities()))
    split = train_test_split(features, test_days=14)
    trained = DemandModelTrainer(Settings()).train(
        features, split, feature_columns=DEFAULT_FEATURE_SPEC.feature_columns()
    )

    metrics = trained.metrics
    assert metrics.train_rows == len(split.train)
    assert metrics.test_rows == 14
    assert 0.0 <= metrics.mae <= metrics.rmse
    assert metrics.r2 > 0.5  # the weekly pattern is learnable
    assert trained.feature_columns == DEFAULT_FEATURE_SPEC.feature_columns()
    # The persisted estimator is refit on all rows, not just the train split.
    assert trained.estimator.n_features_in_ == len(trained.feature_columns)


def test_trainer_rejects_missing_feature_columns() -> None:
    features = build_features(make_daily_frame(seasonal_quantities(60)))
    split = train_test_split(features, test_days=7)
    with pytest.raises(ModelTrainingError, match="missing expected columns"):
        DemandModelTrainer(Settings()).train(features, split, feature_columns=["nope"])


# ---------------------------------------------------------------------------
# Service + artifact store
# ---------------------------------------------------------------------------


def test_train_product_persists_artifacts(tmp_path: Path) -> None:
    service = make_training_service(make_line_items(seasonal_quantities()), tmp_path)
    result = service.train_product(PRODUCT_ID, test_days=14)

    assert result.product_id == PRODUCT_ID
    assert result.model_type == "random_forest"
    assert result.metrics.test_rows == 14

    paths = result.artifacts
    assert paths.model.exists()
    assert paths.metrics.exists()
    assert paths.features.exists()

    metrics_doc = json.loads(paths.metrics.read_text(encoding="utf-8"))
    assert metrics_doc["product_id"] == PRODUCT_ID
    assert metrics_doc["model_type"] == "random_forest"
    assert metrics_doc["metrics"]["mae"] == result.metrics.mae
    assert metrics_doc["metrics"]["rmse"] == result.metrics.rmse
    assert metrics_doc["metrics"]["r2"] == result.metrics.r2
    assert "scikit_learn" in metrics_doc["library_versions"]

    features_doc = json.loads(paths.features.read_text(encoding="utf-8"))
    assert features_doc["feature_columns"] == DEFAULT_FEATURE_SPEC.feature_columns()
    assert features_doc["lags"] == list(DEFAULT_FEATURE_SPEC.lags)
    assert features_doc["rolling_windows"] == list(DEFAULT_FEATURE_SPEC.rolling_windows)
    assert features_doc["target_column"] == "quantity"
    assert features_doc["cleaning"]["rows_in"] == 90

    estimator = joblib.load(paths.model)
    assert estimator.n_features_in_ == len(DEFAULT_FEATURE_SPEC.feature_columns())


def test_load_model_roundtrip(tmp_path: Path) -> None:
    service = make_training_service(make_line_items(seasonal_quantities()), tmp_path)
    service.train_product(PRODUCT_ID, test_days=14)

    store = ModelArtifactStore(tmp_path)
    estimator = store.load_model(PRODUCT_ID)
    metadata = store.load_features_metadata(PRODUCT_ID)
    prediction = estimator.predict(np.zeros((1, len(metadata["feature_columns"]))))
    assert prediction.shape == (1,)


def test_load_model_missing_raises(tmp_path: Path) -> None:
    store = ModelArtifactStore(tmp_path)
    with pytest.raises(ModelNotFoundError):
        store.load_model("no-such-product")
    with pytest.raises(ModelNotFoundError):
        store.load_features_metadata("no-such-product")


def test_train_product_empty_history_raises(tmp_path: Path) -> None:
    empty = pd.DataFrame(columns=["product_id", "sale_date", "quantity"])
    service = make_training_service(empty, tmp_path)
    with pytest.raises(EmptySalesHistoryError):
        service.train_product(PRODUCT_ID)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _stub_result(product_id: str) -> TrainingResult:
    return TrainingResult(
        product_id=product_id,
        model_type="random_forest",
        trained_at=datetime.now(UTC),
        metrics=TrainingMetrics(mae=1.0, rmse=1.5, r2=0.9, train_rows=50, test_rows=14),
        feature_columns=DEFAULT_FEATURE_SPEC.feature_columns(),
        artifacts=ArtifactPaths(
            model=Path("model.joblib"), metrics=Path("metrics.json"), features=Path("f.json")
        ),
    )


def _patch_service(monkeypatch: pytest.MonkeyPatch, stub: SimpleNamespace) -> None:
    factory = SimpleNamespace(from_settings=lambda *_args, **_kwargs: stub)
    monkeypatch.setattr("app.training.cli.TrainingService", factory)


def test_cli_trains_listed_products(monkeypatch: pytest.MonkeyPatch) -> None:
    trained: list[str] = []
    stub = SimpleNamespace(
        train_product=lambda product_id, **_: trained.append(product_id)
        or _stub_result(product_id),
    )
    _patch_service(monkeypatch, stub)
    assert cli_main([PRODUCT_ID]) == 0
    assert trained == [PRODUCT_ID]


def test_cli_all_trains_every_listed_product(monkeypatch: pytest.MonkeyPatch) -> None:
    trained: list[str] = []
    stub = SimpleNamespace(
        list_trainable_products=lambda: [PRODUCT_ID, "second-product"],
        train_product=lambda product_id, **_: trained.append(product_id)
        or _stub_result(product_id),
    )
    _patch_service(monkeypatch, stub)
    assert cli_main(["--all"]) == 0
    assert trained == [PRODUCT_ID, "second-product"]


def test_cli_returns_nonzero_when_a_product_fails(monkeypatch: pytest.MonkeyPatch) -> None:
    def failing(*_args, **_kwargs) -> TrainingResult:
        raise EmptySalesHistoryError("no sales history found")

    _patch_service(monkeypatch, SimpleNamespace(train_product=failing))
    assert cli_main([PRODUCT_ID]) == 1


def test_cli_requires_products() -> None:
    assert cli_main([]) == 2


def test_cli_rejects_ids_combined_with_all() -> None:
    assert cli_main([PRODUCT_ID, "--all"]) == 2
