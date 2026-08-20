from fastapi import APIRouter
from app.api.v1.health import router as health_router
from app.api.v1.auth import router as auth_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.verification import router as verification_router
from app.api.v1.analytics import router as analytics_router

api_v1_router = APIRouter()
api_v1_router.include_router(health_router, tags=["health"])
api_v1_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_v1_router.include_router(tickets_router, prefix="/tickets", tags=["tickets"])
api_v1_router.include_router(evidence_router, prefix="/tickets", tags=["evidence"])
api_v1_router.include_router(verification_router, prefix="/verification", tags=["verification"])
api_v1_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])

__all__ = ["api_v1_router"]

