"""Time-series preparation helpers."""

from collections.abc import Sequence
from datetime import date
from typing import Protocol

import numpy as np


class DatedQuantity(Protocol):
    """Anything carrying a calendar date and a non-negative quantity."""

    date: date
    quantity: float


def to_daily_series(points: Sequence[DatedQuantity]) -> tuple[np.ndarray, date, date]:
    """Convert dated observations into a gap-free daily demand series.

    Observations are sorted by date and reindexed onto every calendar day in
    the observed range; days without a recorded sale are treated as zero
    demand, which matches how the ForecastIQ sales ledger behaves.

    Returns ``(values, first_date, last_date)`` where ``values[i]`` is the
    demand on ``first_date + i`` days.
    """
    ordered = sorted(points, key=lambda point: point.date)
    first_date = ordered[0].date
    last_date = ordered[-1].date
    length = (last_date - first_date).days + 1
    values = np.zeros(length, dtype=float)
    for point in ordered:
        values[(point.date - first_date).days] = float(point.quantity)
    return values, first_date, last_date
