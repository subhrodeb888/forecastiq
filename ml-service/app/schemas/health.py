"""Schemas for health and readiness probes."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class HealthStatus(BaseModel):
    status: Literal["ok"] = "ok"
    service: str
    version: str
    environment: str
    uptime_seconds: float
    timestamp: datetime


class ReadinessStatus(BaseModel):
    status: Literal["ready", "not_ready"]
    checks: dict[str, str]
    models: list[str]
    timestamp: datetime
