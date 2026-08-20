"""Liveness and readiness probes for load balancers and orchestrators."""

import time
from datetime import UTC, datetime

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from app.api.deps import SettingsDep
from app.models.registry import all_specs
from app.schemas.health import HealthStatus, ReadinessStatus

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="Liveness probe",
)
async def liveness(request: Request, settings: SettingsDep) -> HealthStatus:
    """The process is up and serving; cheap enough for frequent polling."""
    return HealthStatus(
        service=settings.app_name,
        version=settings.app_version,
        environment=settings.environment,
        uptime_seconds=round(time.monotonic() - request.app.state.started_monotonic, 3),
        timestamp=datetime.now(UTC),
    )


@router.get(
    "/health/ready",
    response_model=ReadinessStatus,
    summary="Readiness probe",
)
async def readiness(request: Request) -> JSONResponse:
    """The service has everything it needs to produce forecasts."""
    models = [spec.name for spec in all_specs()]
    registry_ok = bool(models)
    app_started = hasattr(request.app.state, "started_monotonic")
    ready = registry_ok and app_started

    payload = ReadinessStatus(
        status="ready" if ready else "not_ready",
        checks={
            "model_registry": "ok" if registry_ok else "unavailable",
            "application": "ok" if app_started else "starting",
        },
        models=models,
        timestamp=datetime.now(UTC),
    )
    return JSONResponse(
        status_code=200 if ready else 503,
        content=payload.model_dump(mode="json"),
    )
