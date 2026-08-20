"""Schemas for the demand-forecasting API.

The request carries a product's daily sales history (mirroring the
``sale_items``/``sales`` tables of the ForecastIQ web app); the response
mirrors the ``forecasts`` table shape — one row per future date with a
predicted demand and a confidence score.
"""

from datetime import date, datetime
from enum import StrEnum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ModelName(StrEnum):
    AUTO = "auto"
    MOVING_AVERAGE = "moving_average"
    LINEAR_TREND = "linear_trend"
    HOLT_WINTERS = "holt_winters"


class SalesHistoryPoint(BaseModel):
    """One observed day of demand for a product."""

    date: date
    quantity: int = Field(ge=0)


class SalesHistoryRequest(BaseModel):
    """Shared base for endpoints that consume a product's daily sales history."""

    product_id: UUID
    history: list[SalesHistoryPoint] = Field(min_length=2)

    @field_validator("history")
    @classmethod
    def _reject_duplicate_dates(
        cls, points: list[SalesHistoryPoint]
    ) -> list[SalesHistoryPoint]:
        dates = [point.date for point in points]
        if len(dates) != len(set(dates)):
            raise ValueError("history contains duplicate dates")
        return points


class ForecastRequest(SalesHistoryRequest):
    horizon_days: int | None = Field(default=None, ge=1, le=365)
    model: ModelName = ModelName.AUTO
    season_length: int | None = Field(
        default=None,
        ge=2,
        le=60,
        description="Seasonal cycle length in days (e.g. 7 for weekly seasonality).",
    )
    include_intervals: bool = True


class ForecastPoint(BaseModel):
    """One forecasted day, matching a row of the ForecastIQ ``forecasts`` table."""

    date: date
    predicted_demand: int = Field(ge=0)
    lower_bound: int | None = Field(default=None, ge=0)
    upper_bound: int | None = Field(default=None, ge=0)


class ForecastMetrics(BaseModel):
    """Backtest accuracy of the selected model on this product's history."""

    mae: float = Field(description="Mean absolute error in units/day.")
    smape: float = Field(description="Symmetric mean absolute percentage error (0-200).")
    confidence_score: float = Field(ge=0, le=100, description="Forecast confidence, 0-100.")


class ForecastResponse(BaseModel):
    product_id: UUID
    model: str
    horizon_days: int
    season_length: int | None
    generated_at: datetime
    points: list[ForecastPoint]
    metrics: ForecastMetrics


class ModelInfo(BaseModel):
    name: str
    description: str
    supports_seasonality: bool


class ModelListResponse(BaseModel):
    models: list[ModelInfo]
    default: str = ModelName.AUTO
