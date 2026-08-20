"""Schemas for the trained-model prediction API.

The request carries a product's recent daily sales (same shape as the
forecasting API); the service rebuilds the exact features the persisted
Random Forest was trained on — using the preprocessing contract saved at
training time — and recursively forecasts future demand.
"""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.forecast import ForecastPoint, SalesHistoryRequest


class PredictRequest(SalesHistoryRequest):
    """Recent daily history plus the horizon to predict."""

    horizon_days: int | None = Field(default=None, ge=1, le=365)
    include_intervals: bool = True


class ModelMetrics(BaseModel):
    """Holdout evaluation of the persisted model, recorded at training time."""

    mae: float = Field(description="Mean absolute error in units/day.")
    rmse: float = Field(description="Root mean squared error in units/day.")
    r2: float = Field(description="Coefficient of determination on the holdout split.")
    confidence_score: float = Field(ge=0, le=100, description="Prediction confidence, 0-100.")
    trained_at: datetime


class PredictResponse(BaseModel):
    product_id: UUID
    model: str
    horizon_days: int
    generated_at: datetime
    points: list[ForecastPoint]
    metrics: ModelMetrics
