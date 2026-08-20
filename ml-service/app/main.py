"""Application factory and lifecycle management."""

import logging
import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.deps import get_prediction_service
from app.api.errors import register_exception_handlers
from app.api.middleware import RequestContextMiddleware
from app.api.v1.router import api_v1_router
from app.core.config import get_settings
from app.core.logging import configure_logging

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Startup: logging, boot time, model preload; shutdown: log."""
    settings = get_settings()
    configure_logging(settings.log_level, settings.use_json_logs)
    app.state.started_monotonic = time.monotonic()
    preloaded = get_prediction_service().preload()
    logger.info(
        "%s v%s started (environment=%s, docs=%s, models_preloaded=%d)",
        settings.app_name,
        settings.app_version,
        settings.environment,
        "enabled" if settings.docs_available else "disabled",
        preloaded,
    )
    yield
    logger.info("%s shutdown complete", settings.app_name)


def create_app() -> FastAPI:
    """Build and configure the FastAPI application."""
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        summary="Demand forecasting microservice for the ForecastIQ platform.",
        lifespan=lifespan,
        docs_url="/docs" if settings.docs_available else None,
        redoc_url="/redoc" if settings.docs_available else None,
        openapi_url="/openapi.json" if settings.docs_available else None,
    )

    # Middleware: the last one added runs outermost.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=settings.cors_allow_credentials,
        allow_methods=settings.cors_allow_method_list,
        allow_headers=settings.cors_allow_header_list,
    )
    app.add_middleware(GZipMiddleware, minimum_size=1024)
    app.add_middleware(RequestContextMiddleware)

    register_exception_handlers(app)
    app.include_router(api_v1_router, prefix=settings.api_v1_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str | None]:
        return {
            "service": settings.app_name,
            "version": settings.app_version,
            "environment": settings.environment,
            "api": settings.api_v1_prefix,
            "docs": "/docs" if settings.docs_available else None,
        }

    return app
