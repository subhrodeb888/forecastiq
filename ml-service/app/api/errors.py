"""Exception handlers producing the consistent error envelope."""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.core.exceptions import AppError
from app.schemas.common import ErrorBody, ErrorEnvelope

logger = logging.getLogger(__name__)


def _envelope(
    status_code: int,
    code: str,
    message: str,
    details: Any,
    request_id: str | None,
) -> JSONResponse:
    payload = ErrorEnvelope(
        error=ErrorBody(code=code, message=message, details=details),
        request_id=request_id,
    )
    return JSONResponse(status_code=status_code, content=payload.model_dump(mode="json"))


def _request_id(request: Request) -> str | None:
    return getattr(request.state, "request_id", None)


def register_exception_handlers(app: FastAPI) -> None:
    """Register handlers so every failure path returns the same envelope."""

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        if exc.status_code >= 500:
            logger.error("application error: %s", exc.message)
        return _envelope(
            exc.status_code, exc.code, exc.message, exc.details, _request_id(request)
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        details = [
            {
                "loc": [str(part) for part in error["loc"]],
                "msg": error["msg"],
                "type": error["type"],
            }
            for error in exc.errors()
        ]
        return _envelope(
            422, "validation_error", "request validation failed", details, _request_id(request)
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_exception(
        request: Request, exc: StarletteHTTPException
    ) -> JSONResponse:
        message = exc.detail if isinstance(exc.detail, str) else "request failed"
        return _envelope(
            exc.status_code, f"http_{exc.status_code}", message, None, _request_id(request)
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled error while processing request")
        return _envelope(
            500, "internal_error", "an unexpected error occurred", None, _request_id(request)
        )
