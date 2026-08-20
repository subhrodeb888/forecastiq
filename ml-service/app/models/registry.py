"""Registry of available forecasting models.

Decouples model discovery from the service layer: adding a new model means
registering one ``ModelSpec`` here — no service or endpoint changes needed.
"""

from collections.abc import Callable
from dataclasses import dataclass

from app.models.base import ForecastModel
from app.models.holt_winters import HoltWintersModel
from app.models.linear_trend import LinearTrendModel
from app.models.moving_average import MovingAverageModel

# Factories receive the resolved season length (or None) and return a fresh,
# unfitted model instance — important because backtests fit many candidates.
ModelFactory = Callable[[int | None], ForecastModel]


@dataclass(frozen=True)
class ModelSpec:
    name: str
    description: str
    supports_seasonality: bool
    factory: ModelFactory


_REGISTRY: dict[str, ModelSpec] = {
    spec.name: spec
    for spec in (
        ModelSpec(
            name=MovingAverageModel.name,
            description=MovingAverageModel.description,
            supports_seasonality=MovingAverageModel.supports_seasonality,
            factory=lambda season_length: MovingAverageModel(window=season_length),
        ),
        ModelSpec(
            name=LinearTrendModel.name,
            description=LinearTrendModel.description,
            supports_seasonality=LinearTrendModel.supports_seasonality,
            factory=lambda season_length: LinearTrendModel(season_length=season_length),
        ),
        ModelSpec(
            name=HoltWintersModel.name,
            description=HoltWintersModel.description,
            supports_seasonality=HoltWintersModel.supports_seasonality,
            factory=lambda season_length: HoltWintersModel(season_length=season_length),
        ),
    )
}


def all_specs() -> tuple[ModelSpec, ...]:
    """Every registered model, in registry order."""
    return tuple(_REGISTRY.values())


def get_spec(name: str) -> ModelSpec | None:
    """Look up one model by name; ``None`` when unregistered."""
    return _REGISTRY.get(name)
