"""Health and readiness endpoint tests."""

from fastapi.testclient import TestClient


def test_liveness_returns_service_metadata(client: TestClient) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ForecastIQ ML Service"
    assert body["version"]
    assert body["environment"] == "development"
    assert body["uptime_seconds"] >= 0


def test_readiness_reports_registered_models(client: TestClient) -> None:
    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["checks"]["model_registry"] == "ok"
    assert {"moving_average", "linear_trend", "holt_winters"} <= set(body["models"])


def test_responses_carry_a_request_id_header(client: TestClient) -> None:
    response = client.get("/api/v1/health")
    assert response.headers["X-Request-ID"]

    traced = client.get("/api/v1/health", headers={"X-Request-ID": "trace-123"})
    assert traced.headers["X-Request-ID"] == "trace-123"
