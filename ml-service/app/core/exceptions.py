"""Domain exceptions mapped to consistent HTTP error responses."""

from typing import Any


class AppError(Exception):
    """Base class for application errors rendered as a JSON error envelope."""

    status_code: int = 500
    code: str = "internal_error"

    def __init__(self, message: str, *, details: Any = None) -> None:
        self.message = message
        self.details = details
        super().__init__(message)


class ValidationError(AppError):
    status_code = 422
    code = "validation_error"


class InsufficientHistoryError(AppError):
    status_code = 422
    code = "insufficient_history"


class HorizonLimitError(AppError):
    status_code = 422
    code = "horizon_limit_exceeded"


class UnknownModelError(AppError):
    status_code = 400
    code = "unknown_model"


class ForecastComputationError(AppError):
    status_code = 500
    code = "forecast_computation_error"


class DataLoadingError(AppError):
    status_code = 500
    code = "data_loading_error"


class EmptySalesHistoryError(AppError):
    status_code = 422
    code = "empty_sales_history"


class ModelTrainingError(AppError):
    status_code = 500
    code = "model_training_error"


class ArtifactPersistenceError(AppError):
    status_code = 500
    code = "artifact_persistence_error"


class ModelNotFoundError(AppError):
    status_code = 404
    code = "model_not_found"
