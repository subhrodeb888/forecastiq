"""Abstract contract implemented by every forecasting model."""

from abc import ABC, abstractmethod
from typing import ClassVar, Self

import numpy as np


class ForecastModel(ABC):
    """A fit-once, predict-many univariate demand forecasting model."""

    name: ClassVar[str]
    description: ClassVar[str]
    supports_seasonality: ClassVar[bool] = False

    @abstractmethod
    def fit(self, y: np.ndarray) -> Self:
        """Fit the model on a daily demand series."""

    @abstractmethod
    def predict(self, steps: int) -> np.ndarray:
        """Forecast the next ``steps`` days; values are clamped to be non-negative."""

    @abstractmethod
    def fitted_residuals(self) -> np.ndarray:
        """One-step-ahead in-sample errors from the most recent ``fit``."""

    def _require_fitted(self) -> None:
        if not getattr(self, "_fitted", False):
            raise RuntimeError(f"{type(self).__name__} must be fitted before use")
