"""Out-of-sample model evaluation via time-series cross-validation."""

from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from app.models.base import ForecastModel
from app.utils.metrics import smape


@dataclass(frozen=True)
class EvaluationResult:
    """Pooled out-of-sample accuracy for one model on one series."""

    mae: float
    smape: float
    residuals: np.ndarray


def backtest(
    model_factory: Callable[[], ForecastModel],
    y: np.ndarray,
    *,
    horizon: int = 7,
    max_folds: int = 3,
    min_train: int = 8,
) -> EvaluationResult:
    """Evaluate a model with an expanding-window time-series backtest.

    The last ``max_folds * horizon`` observations are reserved as rolling
    out-of-sample windows. Series too short for fold-based evaluation fall
    back to expanding one-step-ahead forecasts over the second half of the
    history, so every model is always judged on data it never fitted on.
    """
    y = np.asarray(y, dtype=float)
    if y.size < 3:
        raise ValueError("backtest requires at least three observations")

    actual_parts: list[np.ndarray] = []
    predicted_parts: list[np.ndarray] = []

    for k in range(max_folds, 0, -1):
        cutoff = y.size - k * horizon
        if cutoff < min_train:
            continue
        train, test = y[:cutoff], y[cutoff : cutoff + horizon]
        if test.size == 0:
            continue
        model = model_factory()
        model.fit(train)
        actual_parts.append(test)
        predicted_parts.append(model.predict(test.size))

    if not actual_parts:
        for t in range(max(2, y.size // 2), y.size):
            model = model_factory()
            model.fit(y[:t])
            actual_parts.append(y[t : t + 1])
            predicted_parts.append(model.predict(1))

    actuals = np.concatenate(actual_parts)
    predicted = np.concatenate(predicted_parts)
    residuals = actuals - predicted

    return EvaluationResult(
        mae=float(np.mean(np.abs(residuals))),
        smape=smape(actuals, predicted),
        residuals=residuals,
    )
