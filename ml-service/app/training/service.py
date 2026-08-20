"""Orchestrates dataset preparation, model training, and persistence."""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import Engine

from app.core.config import Settings
from app.pipeline.features import DEFAULT_FEATURE_SPEC, FeatureSpec
from app.pipeline.service import DataPipelineService
from app.training.artifacts import ModelArtifactStore
from app.training.schemas import MODEL_TYPE, TrainingResult
from app.training.trainer import DemandModelTrainer

logger = logging.getLogger(__name__)


class TrainingService:
    """End-to-end training pipeline for one product or a fleet of them.

    Composes the data pipeline (load → clean → features → split), the
    trainer (holdout evaluation + full-data refit), and the artifact store
    (joblib model, metrics JSON, preprocessing contract).
    """

    def __init__(
        self,
        settings: Settings,
        pipeline: DataPipelineService,
        trainer: DemandModelTrainer,
        store: ModelArtifactStore,
    ) -> None:
        self._settings = settings
        self._pipeline = pipeline
        self._trainer = trainer
        self._store = store

    @classmethod
    def from_settings(
        cls, settings: Settings, engine: Engine | None = None
    ) -> "TrainingService":
        """Wire the service to the shared database engine and artifact root."""
        return cls(
            settings,
            DataPipelineService.from_settings(settings, engine),
            DemandModelTrainer(settings),
            ModelArtifactStore(settings.model_artifacts_dir),
        )

    def list_trainable_products(self) -> list[str]:
        """Product ids that have at least one recorded sale line item."""
        return self._pipeline.list_products()

    def train_product(
        self,
        product_id: UUID | str,
        *,
        test_days: int | None = None,
        test_fraction: float | None = None,
        feature_spec: FeatureSpec = DEFAULT_FEATURE_SPEC,
    ) -> TrainingResult:
        """Prepare, train, evaluate, and persist a model for one product.

        Pipeline and split validation errors
        (:class:`EmptySalesHistoryError`, :class:`ValidationError`),
        :class:`ModelTrainingError`, and :class:`ArtifactPersistenceError`
        propagate to the caller.
        """
        prepared = self._pipeline.prepare_dataset(
            product_id,
            test_days=test_days,
            test_fraction=test_fraction,
            feature_spec=feature_spec,
        )
        trained = self._trainer.train(
            prepared.features,
            prepared.split,
            feature_columns=feature_spec.feature_columns(),
        )
        trained_at = datetime.now(UTC)
        artifacts = self._store.save(
            product_id=prepared.product_id,
            model=trained,
            feature_spec=feature_spec,
            prepared=prepared,
            trained_at=trained_at,
        )
        logger.info(
            "model trained: product=%s model=%s mae=%.3f rmse=%.3f r2=%.3f -> %s",
            prepared.product_id,
            trained.model_type,
            trained.metrics.mae,
            trained.metrics.rmse,
            trained.metrics.r2,
            artifacts.model,
        )
        return TrainingResult(
            product_id=prepared.product_id,
            model_type=MODEL_TYPE,
            trained_at=trained_at,
            metrics=trained.metrics,
            feature_columns=trained.feature_columns,
            artifacts=artifacts,
        )
