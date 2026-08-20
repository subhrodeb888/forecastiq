"""Aggregate router for API v1."""

from fastapi import APIRouter

from app.api.v1.endpoints import forecast, health, predict

api_v1_router = APIRouter()
api_v1_router.include_router(health.router)
api_v1_router.include_router(forecast.router)
api_v1_router.include_router(predict.router)
