"""Joblib/JSON persistence for trained models and preprocessing artifacts."""

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any

import joblib
import sklearn
from sklearn.ensemble import RandomForestRegressor

from app.core.exceptions import ArtifactPersistenceError, ModelNotFoundError
from app.pipeline.features import TARGET_COLUMN, FeatureSpec
from app.pipeline.schemas import PipelineResult
from app.training.schemas import ArtifactPaths, TrainedModel

logger = logging.getLogger(__name__)


class ModelArtifactStore:
    """Persists one directory per product under a common root.

    Layout::

        <root>/<product_id>/model.joblib   fitted estimator (joblib)
        <root>/<product_id>/metrics.json   holdout MAE/RMSE/R² + versions
        <root>/<product_id>/features.json  preprocessing contract needed at
                                           inference: feature columns, lag/
                                           rolling spec, training window,
                                           cleaning audit

    JSON writes are atomic (temp file + replace) so a crashed run never
    leaves a half-written artifact behind.
    """

    MODEL_FILE = "model.joblib"
    METRICS_FILE = "metrics.json"
    FEATURES_FILE = "features.json"

    def __init__(self, root: Path | str) -> None:
        self._root = Path(root)

    def paths_for(self, product_id: str) -> ArtifactPaths:
        """Artifact locations for a product (the files may not exist yet)."""
        directory = self._root / product_id
        return ArtifactPaths(
            model=directory / self.MODEL_FILE,
            metrics=directory / self.METRICS_FILE,
            features=directory / self.FEATURES_FILE,
        )

    def save(
        self,
        *,
        product_id: str,
        model: TrainedModel,
        feature_spec: FeatureSpec,
        prepared: PipelineResult,
        trained_at: datetime,
    ) -> ArtifactPaths:
        """Persist the estimator, metrics, and preprocessing contract."""
        paths = self.paths_for(product_id)
        try:
            paths.model.parent.mkdir(parents=True, exist_ok=True)
            joblib.dump(model.estimator, paths.model)
            self._write_json(
                paths.metrics,
                {
                    "product_id": product_id,
                    "model_type": model.model_type,
                    "trained_at": trained_at.isoformat(),
                    "metrics": model.metrics.as_dict(),
                    "library_versions": {"scikit_learn": sklearn.__version__},
                },
            )
            self._write_json(
                paths.features,
                {
                    "product_id": product_id,
                    "target_column": TARGET_COLUMN,
                    "feature_columns": model.feature_columns,
                    "lags": list(feature_spec.lags),
                    "rolling_windows": list(feature_spec.rolling_windows),
                    "first_date": prepared.first_date.isoformat(),
                    "last_date": prepared.last_date.isoformat(),
                    "cleaning": prepared.cleaning.as_dict(),
                },
            )
        except (OSError, TypeError, ValueError) as exc:
            raise ArtifactPersistenceError(
                "failed to persist training artifacts",
                details={"product_id": product_id, "reason": str(exc)},
            ) from exc
        logger.info("artifacts saved for product %s under %s", product_id, paths.model.parent)
        return paths

    def list_products(self) -> list[str]:
        """Product ids with a persisted model under the root (empty if none)."""
        if not self._root.exists():
            return []
        return sorted(path.parent.name for path in self._root.glob(f"*/{self.MODEL_FILE}"))

    def load_model(self, product_id: str) -> RandomForestRegressor:
        """Load a previously trained estimator."""
        path = self.paths_for(product_id).model
        if not path.exists():
            raise ModelNotFoundError(
                "no trained model found",
                details={"product_id": product_id, "path": str(path)},
            )
        try:
            estimator: RandomForestRegressor = joblib.load(path)
        except (OSError, ValueError, EOFError) as exc:
            raise ArtifactPersistenceError(
                "failed to load trained model",
                details={"product_id": product_id, "reason": str(exc)},
            ) from exc
        return estimator

    def load_metrics(self, product_id: str) -> dict[str, Any]:
        """Load the holdout metrics persisted at training time."""
        return self._read_json(self.paths_for(product_id).metrics, product_id, "metrics")

    def load_features_metadata(self, product_id: str) -> dict[str, Any]:
        """Load the preprocessing contract persisted alongside the model."""
        return self._read_json(
            self.paths_for(product_id).features, product_id, "feature metadata"
        )

    @staticmethod
    def _read_json(path: Path, product_id: str, what: str) -> dict[str, Any]:
        if not path.exists():
            raise ModelNotFoundError(
                f"no {what} found",
                details={"product_id": product_id, "path": str(path)},
            )
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise ArtifactPersistenceError(
                f"failed to load {what}",
                details={"product_id": product_id, "reason": str(exc)},
            ) from exc

    @staticmethod
    def _write_json(path: Path, payload: dict[str, Any]) -> None:
        """Atomically write ``payload`` as pretty-printed JSON."""
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        tmp.replace(path)
