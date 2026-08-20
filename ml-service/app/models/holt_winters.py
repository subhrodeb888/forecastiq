"""Additive Holt-Winters exponential smoothing."""

import numpy as np

from app.models.base import ForecastModel


class HoltWintersModel(ForecastModel):
    """Triple exponential smoothing with additive trend and seasonality.

    Smoothing parameters are selected by grid search over the in-sample
    one-step-ahead sum of squared errors. When the history is shorter than
    two full seasonal cycles the model degrades gracefully to Holt's linear
    (non-seasonal) method.
    """

    name = "holt_winters"
    description = (
        "Additive Holt-Winters exponential smoothing with grid-searched "
        "smoothing parameters; captures level, trend, and weekly seasonality."
    )
    supports_seasonality = True

    _ALPHAS = (0.1, 0.3, 0.5, 0.7, 0.9)
    _BETAS = (0.01, 0.05, 0.1, 0.2)
    _GAMMAS = (0.05, 0.1, 0.3)

    def __init__(self, season_length: int | None = None) -> None:
        self.season_length = season_length
        self._fitted = False

    def fit(self, y: np.ndarray) -> "HoltWintersModel":
        y = np.asarray(y, dtype=float)
        if y.size < 2:
            raise ValueError("Holt-Winters requires at least two observations")

        m = (
            self.season_length
            if self.season_length and y.size >= 2 * self.season_length
            else None
        )
        gammas = self._GAMMAS if m else (0.0,)

        best: tuple[float, float, float, np.ndarray | None, np.ndarray] | None = None
        for alpha in self._ALPHAS:
            for beta in self._BETAS:
                for gamma in gammas:
                    candidate = self._smooth(y, m, alpha, beta, gamma)
                    if best is None or candidate[0] < best[0]:
                        best = candidate

        assert best is not None  # grid is never empty
        _, self._level, self._trend, self._seasonals, errors = best
        self._n = y.size
        self._m = m

        # Discard warm-up errors produced while the initial state stabilizes.
        warmup = m if m else 1
        self._residuals = errors[warmup:] if errors.size > warmup else errors[-1:]
        self._fitted = True
        return self

    @staticmethod
    def _smooth(
        y: np.ndarray,
        m: int | None,
        alpha: float,
        beta: float,
        gamma: float,
    ) -> tuple[float, float, float, np.ndarray | None, np.ndarray]:
        """Run the recursions; return (SSE, level, trend, seasonals, errors)."""
        n = y.size
        if m:
            level = float(np.mean(y[:m]))
            trend = float((np.mean(y[m : 2 * m]) - level) / m)
            seasonals: np.ndarray | None = (y[:m] - level).astype(float).copy()
        else:
            level = float(y[0])
            trend = float(y[1] - y[0])
            seasonals = None

        errors = np.empty(n, dtype=float)
        sse = 0.0
        for t in range(n):
            seasonal = seasonals[t % m] if m else 0.0
            error = y[t] - (level + trend + seasonal)
            errors[t] = error
            sse += error * error

            if m and seasonals is not None:
                new_level = alpha * (y[t] - seasonal) + (1.0 - alpha) * (level + trend)
                seasonals[t % m] = gamma * (y[t] - new_level) + (1.0 - gamma) * seasonal
                trend = beta * (new_level - level) + (1.0 - beta) * trend
                level = new_level
            else:
                new_level = alpha * y[t] + (1.0 - alpha) * (level + trend)
                trend = beta * (new_level - level) + (1.0 - beta) * trend
                level = new_level

        return sse, level, trend, seasonals, errors

    def predict(self, steps: int) -> np.ndarray:
        self._require_fitted()
        steps = int(steps)
        ahead = np.arange(1, steps + 1, dtype=float)
        forecast = self._level + ahead * self._trend
        if self._m and self._seasonals is not None:
            phase_index = (self._n + np.arange(steps)) % self._m
            forecast = forecast + self._seasonals[phase_index]
        return np.maximum(forecast, 0.0)

    def fitted_residuals(self) -> np.ndarray:
        self._require_fitted()
        return self._residuals
