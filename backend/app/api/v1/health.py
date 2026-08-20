from fastapi import APIRouter
from app.schemas.health import HealthResponse

router = APIRouter()

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint returning system status and service name.
    Response: {"status": "ok", "service": "meikaan"}
    """
    return HealthResponse(status="ok", service="meikaan")
