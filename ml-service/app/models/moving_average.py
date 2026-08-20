"""Trailing moving-average forecaster."""

import numpy as np

from app.models.base import ForecastModel


class MovingAverageModel(ForecastModel):
    """Forecasts the mean of the most recent ``window`` observations.

    A robust baseline for short or noisy demand histories where trend and
    seasonality estimates would be unreliable.
    """

    name = "moving_average"
    description = (
        "Trailing moving average; robust baseline for short or noisy demand histories."
    )
    supports_seasonality = False

    DEFAULT_WINDOW = 7

    def __init__(self, window: int | None = None) -> None:
        self.window = max(1, window or self.DEFAULT_WINDOW)
        self._fitted = False

    def fit(self, y: np.ndarray) -> "MovingAverageModel":
        y = np.asarray(y, dtype=float)
        if y.size == 0:
            raise ValueError("moving average requires at least one observation")

        self._window = min(self.window, y.size)
        self._level = float(np.mean(y[-self._window :]))

        # One-step-ahead residuals: each point is predicted from the mean of
        # the up-to-`window` observations preceding it.
        cumulative = np.concatenate(([0.0], np.cumsum(y)))
        t = np.arange(1, y.size)
        starts = np.maximum(0, t - self._window)
        predictions = (cumulative[t] - cumulative[starts]) / (t - starts)
        self._residuals = y[1:] - predictions

        self._fitted = True
        return self

    def predict(self, steps: int) -> np.ndarray:
        self._require_fitted()
        return np.full(int(steps), self._level)

    def fitted_residuals(self) -> np.ndarray:
        self._require_fitted()
        return self._residuals
