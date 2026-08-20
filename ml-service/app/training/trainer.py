"""Random Forest training with chronological holdout evaluation."""

import logging

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

from app.core.config import Settings
from app.core.exceptions import ModelTrainingError
from app.pipeline.features import TARGET_COLUMN
from app.pipeline.schemas import DatasetSplit
from app.training.schemas import TrainedModel, TrainingMetrics
from app.utils.metrics import mean_absolute_error, r2_score, root_mean_squared_error

logger = logging.getLogger(__name__)


class DemandModelTrainer:
    """Trains a per-product regressor on engineered pipeline features.

    Random Forest is a deliberate upgrade over the statistical baselines in
    :mod:`app.models`: it exploits the calendar/lag/rolling predictors the
    pipeline engineers, captures non-linear effects (demand saturation,
    day-of-week × level interactions), needs no feature scaling, and
    tolerates zero-inflated demand. Reported metrics come from the
    chronological holdout; the persisted estimator is then refit on all rows
    so the shipped artifact benefits from every observation.
    """

    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def train(
        self,
        features: pd.DataFrame,
        split: DatasetSplit,
        *,
        feature_columns: list[str],
    ) -> TrainedModel:
        """Evaluate on the holdout split, then refit on the full frame."""
        missing = [column for column in feature_columns if column not in features.columns]
        if missing:
            raise ModelTrainingError(
                "feature frame is missing expected columns",
                details={"missing_features": missing},
            )

        holdout = self._fit(split.train[feature_columns], split.train[TARGET_COLUMN])
        predicted = np.clip(
            holdout.predict(split.test[feature_columns].to_numpy(dtype=float)), 0.0, None
        )
        actual = split.test[TARGET_COLUMN].to_numpy(dtype=float)
        metrics = TrainingMetrics(
            mae=round(mean_absolute_error(actual, predicted), 4),
            rmse=round(root_mean_squared_error(actual, predicted), 4),
            r2=round(r2_score(actual, predicted), 4),
            train_rows=len(split.train),
            test_rows=len(split.test),
        )
        logger.info(
            "holdout evaluation: mae=%.4f rmse=%.4f r2=%.4f (train=%d, test=%d)",
            metrics.mae,
            metrics.rmse,
            metrics.r2,
            metrics.train_rows,
            metrics.test_rows,
        )

        estimator = self._fit(features[feature_columns], features[TARGET_COLUMN])
        return TrainedModel(
            estimator=estimator,
            metrics=metrics,
            feature_columns=list(feature_columns),
        )

    def _fit(self, x: pd.DataFrame, y: pd.Series) -> RandomForestRegressor:
        estimator = self._build()
        try:
            estimator.fit(x.to_numpy(dtype=float), y.to_numpy(dtype=float))
        except (ValueError, RuntimeError) as exc:
            raise ModelTrainingError("model fitting failed", details=str(exc)) from exc
        return estimator

    def _build(self) -> RandomForestRegressor:
        settings = self._settings
        return RandomForestRegressor(
            n_estimators=settings.training_n_estimators,
            min_samples_leaf=settings.training_min_samples_leaf,
            random_state=settings.training_random_state,
            n_jobs=-1,
        )
