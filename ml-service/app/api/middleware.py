"""HTTP middleware: request-id correlation and access logging."""

import logging
import time
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from app.core.logging import request_id_ctx

logger = logging.getLogger(__name__)

REQUEST_ID_HEADER = "X-Request-ID"


class RequestContextMiddleware(BaseHTTPMiddleware):
    """Assign every request a correlation id and log its outcome.

    The id is read from an incoming ``X-Request-ID`` header when present
    (so calls can be traced across services), echoed back on the response,
    and attached to every log line emitted while the request is handled.
    """

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid4().hex
        request.state.request_id = request_id
        token = request_id_ctx.set(request_id)
        started = time.perf_counter()

        try:
            response = await call_next(request)
        except Exception:
            duration_ms = (time.perf_counter() - started) * 1000
            logger.exception(
                "%s %s failed after %.1fms",
                request.method,
                request.url.path,
                duration_ms,
            )
            request_id_ctx.reset(token)
            raise

        duration_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "%s %s -> %d %.1fms",
            request.method,
            request.url.path,
            response.status_code,
            duration_ms,
        )
        request_id_ctx.reset(token)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
