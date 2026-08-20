"""Shared construction of forecast/prediction response points."""

from datetime import date, timedelta

import numpy as np

from app.schemas.forecast import ForecastPoint
from app.utils.metrics import prediction_interval


def build_forecast_points(
    raw_forecast: np.ndarray,
    sigma: float,
    last_date: date,
    horizon: int,
    include_intervals: bool,
    *,
    z: float,
) -> list[ForecastPoint]:
    """One response point per future day.

    ``raw_forecast`` values are rounded to non-negative integers; when
    ``include_intervals`` is set, each point carries bounds derived from
    ``sigma`` that widen with the lead time.
    """
    points: list[ForecastPoint] = []
    for step in range(horizon):
        predicted = int(max(0, round(float(raw_forecast[step]))))
        lower: int | None = None
        upper: int | None = None
        if include_intervals:
            lower, upper = prediction_interval(predicted, sigma, step, z)
        points.append(
            ForecastPoint(
                date=last_date + timedelta(days=step + 1),
                predicted_demand=predicted,
                lower_bound=lower,
                upper_bound=upper,
            )
        )
    return points
