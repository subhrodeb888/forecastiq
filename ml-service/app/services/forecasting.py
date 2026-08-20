"""Orchestration layer for demand forecasting."""

import logging
from datetime import UTC, datetime

import numpy as np

from app.core.config import Settings
from app.core.exceptions import (
    ForecastComputationError,
    HorizonLimitError,
    InsufficientHistoryError,
    UnknownModelError,
)
from app.models.evaluation import EvaluationResult, backtest
from app.models.registry import ModelSpec, all_specs, get_spec
from app.schemas.forecast import (
    ForecastMetrics,
    ForecastRequest,
    ForecastResponse,
    ModelInfo,
    ModelListResponse,
    ModelName,
)
from app.services.points import build_forecast_points
from app.utils.metrics import confidence_score
from app.utils.series import to_daily_series

logger = logging.getLogger(__name__)


class ForecastingService:
    """Turns a product's sales history into a validated demand forecast.

    Candidate models are ranked by out-of-sample backtest accuracy (sMAPE);
    the winner is refitted on the full history to produce the forecast,
    prediction intervals, and a confidence score.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def list_models(self) -> ModelListResponse:
        return ModelListResponse(
            models=[
                ModelInfo(
                    name=spec.name,
                    description=spec.description,
                    supports_seasonality=spec.supports_seasonality,
                )
                for spec in all_specs()
            ]
        )

    def generate(self, request: ForecastRequest) -> ForecastResponse:
        settings = self._settings

        if len(request.history) < settings.min_history_points:
            raise InsufficientHistoryError(
                f"at least {settings.min_history_points} history points are required",
                details={
                    "received": len(request.history),
                    "minimum": settings.min_history_points,
                },
            )

        horizon = request.horizon_days or settings.default_horizon_days
        if horizon > settings.max_horizon_days:
            raise HorizonLimitError(
                f"horizon_days cannot exceed {settings.max_horizon_days}",
                details={"received": horizon, "maximum": settings.max_horizon_days},
            )

        season_length = request.season_length or settings.default_season_length
        values, _, last_date = to_daily_series(request.history)
        if values.size > settings.max_history_points:
            logger.info(
                "history truncated to the most recent %d days for product %s",
                settings.max_history_points,
                request.product_id,
            )
            values = values[-settings.max_history_points :]

        candidates = self._resolve_candidates(request.model)
        evaluations = self._evaluate(candidates, values, season_length)
        spec, evaluation = min(evaluations, key=lambda pair: pair[1].smape)

        model = spec.factory(season_length)
        try:
            model.fit(values)
            raw_forecast = model.predict(horizon)
        except (ValueError, RuntimeError) as exc:
            raise ForecastComputationError(
                "model failed to produce a forecast", details=str(exc)
            ) from exc

        if evaluation.residuals.size > 1:
            sigma = float(np.std(evaluation.residuals, ddof=1))
        else:
            sigma = abs(float(evaluation.residuals[0]))
        confidence = confidence_score(evaluation.residuals, float(np.mean(values)))
        points = build_forecast_points(
            raw_forecast,
            sigma,
            last_date,
            horizon,
            request.include_intervals,
            z=settings.prediction_interval_z,
        )

        logger.info(
            "forecast generated: product=%s model=%s horizon=%d smape=%.2f confidence=%.2f",
            request.product_id,
            spec.name,
            horizon,
            evaluation.smape,
            confidence,
        )

        return ForecastResponse(
            product_id=request.product_id,
            model=spec.name,
            horizon_days=horizon,
            season_length=season_length,
            generated_at=datetime.now(UTC),
            points=points,
            metrics=ForecastMetrics(
                mae=round(evaluation.mae, 4),
                smape=round(evaluation.smape, 4),
                confidence_score=confidence,
            ),
        )

    def _resolve_candidates(self, model_name: ModelName) -> list[ModelSpec]:
        if model_name is ModelName.AUTO:
            return list(all_specs())
        spec = get_spec(model_name.value)
        if spec is None:
            raise UnknownModelError(
                f"unknown model '{model_name.value}'",
                details={"available": [registered.name for registered in all_specs()]},
            )
        return [spec]

    def _evaluate(
        self, candidates: list[ModelSpec], values: np.ndarray, season_length: int
    ) -> list[tuple[ModelSpec, EvaluationResult]]:
        backtest_horizon = min(max(season_length, 3), 14)
        results: list[tuple[ModelSpec, EvaluationResult]] = []
        for spec in candidates:
            try:
                result = backtest(
                    lambda spec=spec: spec.factory(season_length),
                    values,
                    horizon=backtest_horizon,
                )
            except ValueError as exc:
                raise ForecastComputationError(
                    "series could not be evaluated", details=str(exc)
                ) from exc
            results.append((spec, result))
        return results
