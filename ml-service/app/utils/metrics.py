"""Forecast-accuracy metrics, confidence scoring, and interval helpers."""

import math

import numpy as np


def mean_absolute_error(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Average absolute deviation between observations and forecasts."""
    return float(np.mean(np.abs(actual - predicted)))


def root_mean_squared_error(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Square root of the mean squared error; penalizes large misses over MAE."""
    return float(np.sqrt(np.mean((actual - predicted) ** 2)))


def r2_score(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Coefficient of determination: 1.0 is perfect, 0.0 matches the mean.

    A constant actual series is degenerate — return 1.0 when predictions are
    also exact, otherwise 0.0.
    """
    residual = float(np.sum((actual - predicted) ** 2))
    total = float(np.sum((actual - np.mean(actual)) ** 2))
    if total == 0.0:
        return 1.0 if residual == 0.0 else 0.0
    return 1.0 - residual / total


def smape(actual: np.ndarray, predicted: np.ndarray) -> float:
    """Symmetric mean absolute percentage error, on a 0-200 scale.

    Terms where both actual and predicted are zero contribute nothing.
    """
    numerator = np.abs(actual - predicted)
    denominator = (np.abs(actual) + np.abs(predicted)) / 2.0
    terms = np.divide(
        numerator,
        denominator,
        out=np.zeros_like(numerator, dtype=float),
        where=denominator != 0,
    )
    return float(np.mean(terms) * 100.0)


def prediction_interval(predicted: float, sigma: float, step: int, z: float) -> tuple[int, int]:
    """``(lower, upper)`` bounds for one forecast step.

    Intervals widen with the square root of the lead time; the lower bound is
    clamped at zero because demand cannot be negative.
    """
    width = z * sigma * math.sqrt(step + 1)
    return int(max(0, math.floor(predicted - width))), int(math.ceil(predicted + width))


def confidence_score(residuals: np.ndarray, series_mean: float) -> float:
    """Map residual dispersion to a 0-100 confidence score.

    Uses the coefficient of variation of backtest residuals relative to the
    mean demand level: a model whose errors are small compared with typical
    demand earns a score near 100, while errors on the order of the demand
    level itself push the score toward 0.
    """
    if residuals.size == 0:
        return 0.0
    sigma = float(np.std(residuals, ddof=1)) if residuals.size > 1 else abs(float(residuals[0]))
    if series_mean <= 0:
        return 0.0 if sigma > 0 else 50.0
    coefficient_of_variation = sigma / series_mean
    score = 100.0 * max(0.0, 1.0 - min(coefficient_of_variation, 1.0))
    return round(score, 2)
