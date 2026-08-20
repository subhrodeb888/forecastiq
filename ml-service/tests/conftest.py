"""Shared fixtures and deterministic test-data builders."""

import math
from collections.abc import Iterator
from datetime import date, timedelta
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import create_app
from app.pipeline.service import DataPipelineService
from app.training.artifacts import ModelArtifactStore
from app.training.service import TrainingService
from app.training.trainer import DemandModelTrainer

PRODUCT_ID = "3f6b2c90-7d0f-4b6d-9d4f-9c2d2c9f4b31"


@pytest.fixture(scope="session")
def client() -> Iterator[TestClient]:
    with TestClient(create_app()) as test_client:
        yield test_client


def make_history(days: int = 60, start: date = date(2026, 1, 1)) -> list[dict]:
    """Deterministic daily demand with trend and weekly seasonality."""
    return [
        {
            "date": (start + timedelta(days=i)).isoformat(),
            "quantity": round(20 + 0.5 * i + 8 * math.sin(2 * math.pi * i / 7)),
        }
        for i in range(days)
    ]


def make_forecast_payload(**overrides) -> dict:
    payload: dict = {
        "product_id": PRODUCT_ID,
        "history": make_history(),
        "horizon_days": 14,
    }
    payload.update(overrides)
    return payload


def make_line_items(
    quantities: list[float],
    *,
    start: date = date(2026, 1, 1),
    product_id: str = PRODUCT_ID,
) -> pd.DataFrame:
    """Raw loader-shaped frame: one line item per day, dates as ``date`` objects."""
    return pd.DataFrame(
        {
            "product_id": [product_id] * len(quantities),
            "sale_date": [start + timedelta(days=i) for i in range(len(quantities))],
            "quantity": [float(q) for q in quantities],
        }
    )


def make_daily_frame(
    quantities: list[float],
    *,
    start: date = date(2026, 1, 1),
    product_id: str = PRODUCT_ID,
) -> pd.DataFrame:
    """Daily-grain frame with a proper datetime column."""
    frame = make_line_items(quantities, start=start, product_id=product_id)
    frame["sale_date"] = pd.to_datetime(frame["sale_date"])
    return frame


class StubLoader:
    """In-memory stand-in for ``SalesDataLoader`` (no database in unit tests)."""

    def __init__(self, frame: pd.DataFrame, product_ids: list[str] | None = None) -> None:
        self._frame = frame
        self._product_ids = product_ids or []

    def load_line_items(self, **_filters: Any) -> pd.DataFrame:
        return self._frame.copy()

    def load_product_ids(self) -> list[str]:
        return list(self._product_ids)


def seasonal_quantities(n: int = 90) -> list[float]:
    """Weekly seasonal pattern with a mild trend that a forest can learn."""
    return [20.0 + 0.1 * i + 6.0 * float(np.sin(2 * np.pi * i / 7)) for i in range(n)]


def make_training_service(frame: pd.DataFrame, artifacts: Path) -> TrainingService:
    """TrainingService wired to the stub loader and a temp artifact root."""
    settings = Settings(model_artifacts_dir=str(artifacts))
    pipeline = DataPipelineService(settings, StubLoader(frame))  # type: ignore[arg-type]
    return TrainingService(
        settings,
        pipeline,
        DemandModelTrainer(settings),
        ModelArtifactStore(artifacts),
    )
