"""Forecast endpoint tests: happy paths, validation, and error envelopes."""

from datetime import date, timedelta

from fastapi.testclient import TestClient

from tests.conftest import make_forecast_payload, make_history


def test_list_models(client: TestClient) -> None:
    response = client.get("/api/v1/forecasts/models")

    assert response.status_code == 200
    body = response.json()
    assert body["default"] == "auto"
    names = {model["name"] for model in body["models"]}
    assert names == {"moving_average", "linear_trend", "holt_winters"}


def test_generate_forecast_returns_requested_horizon(client: TestClient) -> None:
    response = client.post("/api/v1/forecasts", json=make_forecast_payload(horizon_days=14))

    assert response.status_code == 200
    body = response.json()

    assert body["model"] in {"moving_average", "linear_trend", "holt_winters"}
    assert body["horizon_days"] == 14
    assert len(body["points"]) == 14

    last_history_date = date.fromisoformat(make_history()[-1]["date"])
    first_forecast_date = date.fromisoformat(body["points"][0]["date"])
    assert first_forecast_date == last_history_date + timedelta(days=1)

    for point, next_point in zip(body["points"], body["points"][1:], strict=False):
        assert point["predicted_demand"] >= 0
        assert 0 <= point["lower_bound"] <= point["predicted_demand"] <= point["upper_bound"]
        assert date.fromisoformat(next_point["date"]) - date.fromisoformat(
            point["date"]
        ) == timedelta(days=1)

    metrics = body["metrics"]
    assert metrics["mae"] >= 0
    assert 0 <= metrics["smape"] <= 200
    assert 0 <= metrics["confidence_score"] <= 100


def test_generate_forecast_with_specific_model(client: TestClient) -> None:
    response = client.post(
        "/api/v1/forecasts", json=make_forecast_payload(model="moving_average")
    )

    assert response.status_code == 200
    assert response.json()["model"] == "moving_average"


def test_intervals_can_be_disabled(client: TestClient) -> None:
    response = client.post(
        "/api/v1/forecasts", json=make_forecast_payload(include_intervals=False)
    )

    assert response.status_code == 200
    for point in response.json()["points"]:
        assert point["lower_bound"] is None
        assert point["upper_bound"] is None


def test_duplicate_dates_rejected(client: TestClient) -> None:
    history = make_history(days=20)
    history.append(dict(history[-1]))
    response = client.post("/api/v1/forecasts", json=make_forecast_payload(history=history))

    assert response.status_code == 422
    body = response.json()
    assert body["error"]["code"] == "validation_error"
    assert body["request_id"]


def test_insufficient_history_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/forecasts", json=make_forecast_payload(history=make_history(days=3))
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "insufficient_history"


def test_horizon_limit_enforced(client: TestClient) -> None:
    response = client.post(
        "/api/v1/forecasts", json=make_forecast_payload(horizon_days=200)
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "horizon_limit_exceeded"


def test_invalid_model_name_rejected(client: TestClient) -> None:
    response = client.post(
        "/api/v1/forecasts", json=make_forecast_payload(model="prophet")
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"
