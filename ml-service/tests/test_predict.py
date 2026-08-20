"""Prediction endpoint and service tests.

A real model is trained into a temp artifact store per test; the endpoint is
exercised through a TestClient with the prediction-service dependency
overridden, so no database or pre-existing artifacts are required.
"""

from collections.abc import Iterator
from datetime import date, timedelta
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from app.api.deps import get_prediction_service
from app.core.config import Settings
from app.core.exceptions import ModelNotFoundError
from app.main import create_app
from app.schemas.predict import PredictRequest
from app.services.prediction import PredictionService
from app.training.artifacts import ModelArtifactStore
from tests.conftest import (
    PRODUCT_ID,
    make_forecast_payload,
    make_history,
    make_line_items,
    make_training_service,
    seasonal_quantities,
)

UNKNOWN_PRODUCT = "00000000-0000-0000-0000-000000000000"


@pytest.fixture
def artifact_root(tmp_path: Path) -> Path:
    """Train one product into a temporary artifact store."""
    make_training_service(make_line_items(seasonal_quantities()), tmp_path).train_product(
        PRODUCT_ID, test_days=14
    )
    return tmp_path


@pytest.fixture
def prediction_service(artifact_root: Path) -> PredictionService:
    settings = Settings(model_artifacts_dir=str(artifact_root))
    return PredictionService(settings, ModelArtifactStore(artifact_root))


@pytest.fixture
def predict_client(prediction_service: PredictionService) -> Iterator[TestClient]:
    app = create_app()
    app.dependency_overrides[get_prediction_service] = lambda: prediction_service
    with TestClient(app) as test_client:
        yield test_client


def make_predict_payload(**overrides) -> dict:
    payload = make_forecast_payload(history=make_history(45), horizon_days=7)
    payload.update(overrides)
    return payload


class CountingStore(ModelArtifactStore):
    """Counts estimator loads to prove models are served from memory."""

    def __init__(self, root: Path) -> None:
        super().__init__(root)
        self.model_loads = 0

    def load_model(self, product_id: str):  # noqa: ANN001, ANN201
        self.model_loads += 1
        return super().load_model(product_id)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


def test_predict_returns_requested_horizon(predict_client: TestClient) -> None:
    response = predict_client.post("/api/v1/predict", json=make_predict_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["model"] == "random_forest"
    assert body["horizon_days"] == 7
    assert len(body["points"]) == 7

    last_history_date = date.fromisoformat(make_history(45)[-1]["date"])
    first_point_date = date.fromisoformat(body["points"][0]["date"])
    assert first_point_date == last_history_date + timedelta(days=1)

    for point, next_point in zip(body["points"], body["points"][1:], strict=False):
        assert point["predicted_demand"] >= 0
        assert 0 <= point["lower_bound"] <= point["predicted_demand"] <= point["upper_bound"]
        assert date.fromisoformat(next_point["date"]) - date.fromisoformat(
            point["date"]
        ) == timedelta(days=1)

    metrics = body["metrics"]
    assert metrics["mae"] >= 0
    assert metrics["rmse"] >= metrics["mae"]
    assert -1.0 <= metrics["r2"] <= 1.0
    assert 0 <= metrics["confidence_score"] <= 100
    assert metrics["trained_at"]


def test_predict_intervals_can_be_disabled(predict_client: TestClient) -> None:
    response = predict_client.post(
        "/api/v1/predict", json=make_predict_payload(include_intervals=False)
    )
    assert response.status_code == 200
    for point in response.json()["points"]:
        assert point["lower_bound"] is None
        assert point["upper_bound"] is None


def test_predict_unknown_product_returns_404(predict_client: TestClient) -> None:
    response = predict_client.post(
        "/api/v1/predict", json=make_predict_payload(product_id=UNKNOWN_PRODUCT)
    )
    assert response.status_code == 404
    body = response.json()
    assert body["error"]["code"] == "model_not_found"
    assert body["request_id"]


def test_predict_duplicate_dates_rejected(predict_client: TestClient) -> None:
    history = make_history(45)
    history.append(dict(history[-1]))
    response = predict_client.post("/api/v1/predict", json=make_predict_payload(history=history))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


def test_predict_insufficient_history_rejected(predict_client: TestClient) -> None:
    response = predict_client.post(
        "/api/v1/predict", json=make_predict_payload(history=make_history(5))
    )
    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["error"]["details"]["minimum"] > 5


def test_predict_horizon_limit_enforced(predict_client: TestClient) -> None:
    response = predict_client.post("/api/v1/predict", json=make_predict_payload(horizon_days=200))
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "horizon_limit_exceeded"


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------


def test_model_is_loaded_once_and_cached(artifact_root: Path) -> None:
    store = CountingStore(artifact_root)
    settings = Settings(model_artifacts_dir=str(artifact_root))
    service = PredictionService(settings, store)
    request = PredictRequest(**make_predict_payload())

    first = service.predict(request)
    second = service.predict(request)

    assert store.model_loads == 1
    assert [p.predicted_demand for p in first.points] == [
        p.predicted_demand for p in second.points
    ]


def test_preload_loads_persisted_models(artifact_root: Path) -> None:
    store = CountingStore(artifact_root)
    settings = Settings(model_artifacts_dir=str(artifact_root))
    service = PredictionService(settings, store)

    assert service.preload() == 1
    service.predict(PredictRequest(**make_predict_payload()))
    assert store.model_loads == 1  # served from the preloaded cache


def test_preload_without_artifacts_is_a_noop(tmp_path: Path) -> None:
    service = PredictionService(
        Settings(model_artifacts_dir=str(tmp_path)), ModelArtifactStore(tmp_path)
    )
    assert service.preload() == 0


def test_predict_unknown_product_raises(prediction_service: PredictionService) -> None:
    with pytest.raises(ModelNotFoundError):
        prediction_service.predict(
            PredictRequest(**make_predict_payload(product_id=UNKNOWN_PRODUCT))
        )


def test_predict_metrics_match_training_holdout(
    prediction_service: PredictionService, artifact_root: Path
) -> None:
    response = prediction_service.predict(PredictRequest(**make_predict_payload()))
    persisted = ModelArtifactStore(artifact_root).load_metrics(PRODUCT_ID)["metrics"]
    assert response.metrics.mae == persisted["mae"]
    assert response.metrics.rmse == persisted["rmse"]
    assert response.metrics.r2 == persisted["r2"]
