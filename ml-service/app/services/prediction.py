"""Serves demand predictions from trained, persisted models."""

import logging
import threading
from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from app.core.config import Settings
from app.core.exceptions import (
    AppError,
    ArtifactPersistenceError,
    HorizonLimitError,
    ValidationError,
)
from app.pipeline.features import FeatureSpec, build_features
from app.schemas.predict import ModelMetrics, PredictRequest, PredictResponse
from app.services.points import build_forecast_points
from app.training.artifacts import ModelArtifactStore
from app.training.schemas import MODEL_TYPE
from app.utils.metrics import confidence_score
from app.utils.series import to_daily_series

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class _CachedModel:
    """In-memory view of one product's persisted training artifacts."""

    estimator: RandomForestRegressor
    feature_spec: FeatureSpec
    feature_columns: list[str]
    model_type: str
    trained_at: str
    mae: float
    rmse: float
    r2: float


class PredictionService:
    """Turns recent sales into a demand forecast using the trained model.

    Models are loaded once — preloaded from the artifact store at startup via
    :meth:`preload` — and cached in memory. A product first requested after
    boot (e.g. trained while the service was running) is lazy-loaded under a
    lock, so disk reads never happen twice for the same product.
    """

    def __init__(self, settings: Settings, store: ModelArtifactStore) -> None:
        self._settings = settings
        self._store = store
        self._cache: dict[str, _CachedModel] = {}
        self._lock = threading.Lock()

    @classmethod
    def from_settings(cls, settings: Settings) -> "PredictionService":
        """Wire the service to the artifact store configured in settings."""
        return cls(settings, ModelArtifactStore(settings.model_artifacts_dir))

    def preload(self) -> int:
        """Load every persisted model into memory; returns the count loaded.

        Individual corrupt or incomplete artifacts are logged and skipped —
        they must not prevent the service from starting.
        """
        loaded = 0
        for product_id in self._store.list_products():
            try:
                self._cache[product_id] = self._load(product_id)
            except AppError as exc:
                logger.error("model preload failed for %s: %s", product_id, exc.message)
                continue
            loaded += 1
        return loaded

    def predict(self, request: PredictRequest) -> PredictResponse:
        """Forecast future demand for ``request.product_id``.

        The model's holdout RMSE doubles as the interval width and, relative
        to the mean demand level, as the basis for the confidence score.
        """
        settings = self._settings
        product_id = str(request.product_id)
        horizon = request.horizon_days or settings.default_horizon_days
        if horizon > settings.max_horizon_days:
            raise HorizonLimitError(
                f"horizon_days cannot exceed {settings.max_horizon_days}",
                details={"received": horizon, "maximum": settings.max_horizon_days},
            )

        model = self._get(product_id)
        values, _, last_date = to_daily_series(request.history)
        minimum = model.feature_spec.warmup_periods
        if values.size < minimum:
            raise ValidationError(
                "not enough recent history to build prediction features",
                details={"received": int(values.size), "minimum": minimum},
            )

        raw = self._forecast_recursive(values, last_date, horizon, model)
        # A single-element "residual" makes confidence_score use rmse as sigma.
        confidence = confidence_score(np.array([model.rmse]), float(np.mean(values)))
        points = build_forecast_points(
            raw,
            model.rmse,
            last_date,
            horizon,
            request.include_intervals,
            z=settings.prediction_interval_z,
        )

        logger.info(
            "prediction generated: product=%s model=%s horizon=%d r2=%.2f confidence=%.2f",
            product_id,
            model.model_type,
            horizon,
            model.r2,
            confidence,
        )
        return PredictResponse(
            product_id=request.product_id,
            model=model.model_type,
            horizon_days=horizon,
            generated_at=datetime.now(UTC),
            points=points,
            metrics=ModelMetrics(
                mae=model.mae,
                rmse=model.rmse,
                r2=model.r2,
                confidence_score=confidence,
                trained_at=model.trained_at,
            ),
        )

    def _get(self, product_id: str) -> _CachedModel:
        """Return the cached model, lazy-loading it on first use."""
        cached = self._cache.get(product_id)
        if cached is None:
            with self._lock:
                cached = self._cache.get(product_id)
                if cached is None:
                    cached = self._load(product_id)
                    self._cache[product_id] = cached
        return cached

    def _load(self, product_id: str) -> _CachedModel:
        """Load and cross-check the persisted model, features, and metrics."""
        estimator = self._store.load_model(product_id)
        features = self._store.load_features_metadata(product_id)
        metrics = self._store.load_metrics(product_id)
        feature_columns = list(features["feature_columns"])
        if estimator.n_features_in_ != len(feature_columns):
            raise ArtifactPersistenceError(
                "persisted model does not match its feature metadata",
                details={
                    "product_id": product_id,
                    "model_features": int(estimator.n_features_in_),
                    "metadata_features": len(feature_columns),
                },
            )
        holdout = metrics["metrics"]
        return _CachedModel(
            estimator=estimator,
            feature_spec=FeatureSpec(
                lags=tuple(features["lags"]),
                rolling_windows=tuple(features["rolling_windows"]),
            ),
            feature_columns=feature_columns,
            model_type=str(metrics.get("model_type", MODEL_TYPE)),
            trained_at=str(metrics.get("trained_at", "")),
            mae=float(holdout["mae"]),
            rmse=float(holdout["rmse"]),
            r2=float(holdout["r2"]),
        )

    def _forecast_recursive(
        self, values: np.ndarray, last_date: date, horizon: int, model: _CachedModel
    ) -> np.ndarray:
        """One-step forecasts fed back as inputs for the next step."""
        series = [float(value) for value in values]
        predictions = np.zeros(horizon, dtype=float)
        for step in range(horizon):
            next_date = last_date + timedelta(days=step + 1)
            featured = build_features(
                self._feature_frame(series, next_date), model.feature_spec
            )
            row = featured.iloc[[-1]][model.feature_columns].to_numpy(dtype=float)
            predictions[step] = max(0.0, float(model.estimator.predict(row)[0]))
            series.append(float(predictions[step]))
        return predictions

    @staticmethod
    def _feature_frame(series: list[float], next_date: date) -> pd.DataFrame:
        """History plus the target day, ready for ``build_features``.

        The target day's quantity is a placeholder: every history-based
        feature is shifted by at least one day, so its value never leaks into
        its own predictors.
        """
        dates = [next_date - timedelta(days=len(series) - i) for i in range(len(series))]
        return pd.DataFrame(
            {
                "product_id": ["prediction"] * (len(series) + 1),
                "sale_date": pd.to_datetime([*dates, next_date]),
                "quantity": [*series, 0.0],
            }
        )
