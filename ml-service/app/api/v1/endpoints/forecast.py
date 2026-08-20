"""Demand forecasting endpoints."""

from fastapi import APIRouter, status

from app.api.deps import ForecastingServiceDep
from app.schemas.forecast import ForecastRequest, ForecastResponse, ModelListResponse

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get(
    "/models",
    response_model=ModelListResponse,
    summary="List available forecasting models",
)
def list_models(service: ForecastingServiceDep) -> ModelListResponse:
    return service.list_models()


@router.post(
    "",
    response_model=ForecastResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate a demand forecast",
)
def create_forecast(
    payload: ForecastRequest, service: ForecastingServiceDep
) -> ForecastResponse:
    """Forecast daily demand for one product from its sales history.

    The ForecastIQ web app posts a product's aggregated daily sales; the
    response contains one point per future day (matching the ``forecasts``
    table shape) plus backtest metrics and a confidence score. CPU-bound
    work runs in the threadpool via this sync endpoint.
    """
    return service.generate(payload)
