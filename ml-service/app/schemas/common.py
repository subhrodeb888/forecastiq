"""Shared schema primitives used across endpoints."""

from typing import Any

from pydantic import BaseModel


class ErrorBody(BaseModel):
    """Machine-readable error description."""

    code: str
    message: str
    details: Any = None


class ErrorEnvelope(BaseModel):
    """Consistent error response shape returned by every failure path."""

    error: ErrorBody
    request_id: str | None = None
