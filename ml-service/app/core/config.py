"""Application configuration backed by environment variables.

Settings are resolved (in priority order) from real environment variables and
an optional ``.env`` file in the service root. Copy ``.env.example`` to
``.env`` to override defaults locally.
"""

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

from app import __version__

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Runtime configuration for the ML service."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Application
    app_name: str = "ForecastIQ ML Service"
    app_version: str = __version__
    environment: Environment = "development"
    debug: bool = False

    # Server
    host: str = "0.0.0.0"
    port: int = 8000

    # API
    api_v1_prefix: str = "/api/v1"
    docs_enabled: bool | None = None

    # Logging
    log_level: str = "INFO"
    log_json: bool = False

    # CORS — comma-separated values keep .env files human-friendly.
    cors_origins: str = "http://localhost:3000"
    cors_allow_credentials: bool = True
    cors_allow_methods: str = "*"
    cors_allow_headers: str = "*"

    # Database (PostgreSQL — the ForecastIQ Drizzle schema). Accepts a standard
    # ``postgresql://`` URL; the SQLAlchemy/psycopg driver is enforced.
    database_url: str = "postgresql://postgres:postgres@localhost:5432/forecastiq"
    database_echo: bool = False
    database_pool_size: int = 5
    database_max_overflow: int = 10
    database_pool_timeout: int = 30

    # Data pipeline
    default_test_fraction: float = Field(default=0.2, gt=0.0, lt=1.0)
    outlier_iqr_multiplier: float = Field(default=3.0, gt=0.0)

    # Model training & artifacts
    model_artifacts_dir: str = "artifacts"
    training_n_estimators: int = Field(default=300, ge=10)
    training_min_samples_leaf: int = Field(default=2, ge=1)
    training_random_state: int = 42

    # Forecasting
    default_horizon_days: int = 30
    max_horizon_days: int = 90
    min_history_points: int = 8
    max_history_points: int = 730
    default_season_length: int = 7
    prediction_interval_z: float = 1.96

    @field_validator("log_level")
    @classmethod
    def _normalize_log_level(cls, value: str) -> str:
        return value.upper()

    @field_validator("database_url")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        """Rewrite bare ``postgresql://`` URLs to the psycopg (v3) driver."""
        if value.startswith("postgresql://"):
            return "postgresql+psycopg://" + value.removeprefix("postgresql://")
        if value.startswith("postgres://"):
            return "postgresql+psycopg://" + value.removeprefix("postgres://")
        return value

    @field_validator("api_v1_prefix")
    @classmethod
    def _normalize_prefix(cls, value: str) -> str:
        return "/" + value.strip("/")

    @staticmethod
    def _split_csv(value: str) -> list[str]:
        return [item.strip() for item in value.split(",") if item.strip()]

    @property
    def cors_origin_list(self) -> list[str]:
        return self._split_csv(self.cors_origins)

    @property
    def cors_allow_method_list(self) -> list[str]:
        return self._split_csv(self.cors_allow_methods)

    @property
    def cors_allow_header_list(self) -> list[str]:
        return self._split_csv(self.cors_allow_headers)

    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @property
    def docs_available(self) -> bool:
        """Interactive docs are exposed unless explicitly disabled or in production."""
        if self.docs_enabled is not None:
            return self.docs_enabled
        return not self.is_production

    @property
    def use_json_logs(self) -> bool:
        return self.log_json or self.is_production


@lru_cache
def get_settings() -> Settings:
    """Return the process-wide settings instance."""
    return Settings()
