"""Internal data structures for the training pipeline."""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from sklearn.ensemble import RandomForestRegressor

MODEL_TYPE = "random_forest"


@dataclass(frozen=True, slots=True)
class TrainingMetrics:
    """Holdout evaluation of a trained model."""

    mae: float
    rmse: float
    r2: float
    train_rows: int
    test_rows: int

    def as_dict(self) -> dict[str, float | int]:
        """JSON-serializable view persisted in ``metrics.json``."""
        return {
            "mae": self.mae,
            "rmse": self.rmse,
            "r2": self.r2,
            "train_rows": self.train_rows,
            "test_rows": self.test_rows,
        }


@dataclass(frozen=True, slots=True)
class TrainedModel:
    """Fitted estimator plus its holdout evaluation and feature contract."""

    estimator: RandomForestRegressor
    metrics: TrainingMetrics
    feature_columns: list[str]
    model_type: str = MODEL_TYPE


@dataclass(frozen=True, slots=True)
class ArtifactPaths:
    """On-disk locations of one product's persisted training artifacts."""

    model: Path
    metrics: Path
    features: Path

    def as_dict(self) -> dict[str, str]:
        """Plain-dict view for logs and CLI output."""
        return {
            "model": str(self.model),
            "metrics": str(self.metrics),
            "features": str(self.features),
        }


@dataclass(frozen=True, slots=True)
class TrainingResult:
    """Outcome of one training run: evaluation plus artifact locations."""

    product_id: str
    model_type: str
    trained_at: datetime
    metrics: TrainingMetrics
    feature_columns: list[str]
    artifacts: ArtifactPaths
