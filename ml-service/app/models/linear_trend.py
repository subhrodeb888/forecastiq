"""Least-squares trend forecaster with optional seasonal dummies."""

import numpy as np

from app.models.base import ForecastModel


class LinearTrendModel(ForecastModel):
    """OLS regression on time with optional day-of-cycle indicator variables.

    When a season length is supplied and the history spans at least two full
    cycles, ``m - 1`` seasonal dummies capture recurring weekly/monthly
    patterns on top of the linear trend.
    """

    name = "linear_trend"
    description = (
        "Least-squares trend with optional seasonal dummies for cyclical demand."
    )
    supports_seasonality = True

    def __init__(self, season_length: int | None = None) -> None:
        self.season_length = season_length
        self._fitted = False

    def fit(self, y: np.ndarray) -> "LinearTrendModel":
        y = np.asarray(y, dtype=float)
        if y.size < 2:
            raise ValueError("linear trend requires at least two observations")

        self._n = y.size
        self._m = (
            self.season_length
            if self.season_length and y.size >= 2 * self.season_length
            else None
        )
        design = self._design(np.arange(self._n))
        coefficients, *_ = np.linalg.lstsq(design, y, rcond=None)
        self._coefficients = coefficients
        self._residuals = y - design @ coefficients
        self._fitted = True
        return self

    def _design(self, t: np.ndarray) -> np.ndarray:
        columns = [np.ones(t.size, dtype=float), t.astype(float)]
        if self._m:
            phases = t % self._m
            for phase in range(1, self._m):
                columns.append((phases == phase).astype(float))
        return np.column_stack(columns)

    def predict(self, steps: int) -> np.ndarray:
        self._require_fitted()
        future_t = self._n + np.arange(int(steps))
        forecast = self._design(future_t) @ self._coefficients
        return np.maximum(forecast, 0.0)

    def fitted_residuals(self) -> np.ndarray:
        self._require_fitted()
        return self._residuals
