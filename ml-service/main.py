"""ASGI entrypoint for the ForecastIQ ML service.

Usage:
    uvicorn main:app --reload    # development with auto-reload
    python main.py               # settings-driven server (HOST/PORT env vars)
"""

from app.main import create_app

app = create_app()

if __name__ == "__main__":
    import uvicorn

    from app.core.config import get_settings

    settings = get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug and not settings.is_production,
        log_config=None,  # logging is configured by the app's lifespan
    )
