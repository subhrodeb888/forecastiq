"""FastAPI dependency providers shared by endpoints."""

from functools import lru_cache
from typing import Annotated

from fastapi import Depends

from app.core.config import Settings, get_settings
from app.core.database import get_engine
from app.pipeline.loader import SalesDataLoader
from app.pipeline.service import DataPipelineService
from app.services.forecasting import ForecastingService
from app.services.prediction import PredictionService

SettingsDep = Annotated[Settings, Depends(get_settings)]


@lru_cache
def get_forecasting_service() -> ForecastingService:
    """Process-wide forecasting service (stateless, safe to share)."""
    return ForecastingService(get_settings())


ForecastingServiceDep = Annotated[ForecastingService, Depends(get_forecasting_service)]


@lru_cache
def get_prediction_service() -> PredictionService:
    """Process-wide prediction service; models are cached in memory."""
    return PredictionService.from_settings(get_settings())


PredictionServiceDep = Annotated[PredictionService, Depends(get_prediction_service)]


@lru_cache
def get_sales_data_loader() -> SalesDataLoader:
    """Process-wide sales loader bound to the shared database engine."""
    return SalesDataLoader(get_engine())


SalesDataLoaderDep = Annotated[SalesDataLoader, Depends(get_sales_data_loader)]


@lru_cache
def get_data_pipeline_service() -> DataPipelineService:
    """Process-wide data pipeline (stateless, safe to share)."""
    return DataPipelineService(get_settings(), get_sales_data_loader())


DataPipelineServiceDep = Annotated[DataPipelineService, Depends(get_data_pipeline_service)]
