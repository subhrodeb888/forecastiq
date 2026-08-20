"""Prediction endpoints backed by trained, persisted models."""

from fastapi import APIRouter, status

from app.api.deps import PredictionServiceDep
from app.schemas.predict import PredictRequest, PredictResponse

router = APIRouter(prefix="/predict", tags=["predict"])


@router.post(
    "",
    response_model=PredictResponse,
    status_code=status.HTTP_200_OK,
    summary="Predict future demand with the trained model",
)
def create_prediction(
    payload: PredictRequest, service: PredictionServiceDep
) -> PredictResponse:
    """Predict daily demand for one product from its recent sales history.

    Uses the product's persisted Random Forest — loaded once at startup — and
    the preprocessing contract saved at training time. Returns one point per
    future day plus the model's holdout metrics (MAE/RMSE/R²) and a
    confidence score. Unknown products respond 404 ``model_not_found``;
    train first with ``scripts/train.py``. CPU-bound work runs in the
    threadpool via this sync endpoint.
    """
    return service.predict(payload)
