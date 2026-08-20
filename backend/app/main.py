import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api.v1 import api_v1_router
from app.api.v1.auth import router as auth_router
from app.api.v1.tickets import router as tickets_router
from app.api.v1.evidence import router as evidence_router
from app.api.v1.verification import router as verification_router
from app.schemas.health import HealthResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="MEIKAAN — Civic Evidence Integrity Engine API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("meikaan")

# Configure CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS if settings.CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_sanitized_exception_handler(request: Request, exc: Exception):
    """
    Global sanitized exception handler.
    Logs error internally and returns clean error response without leaking tracebacks,
    database schemas, file paths, or secrets.
    """
    logger.error(f"Unhandled Exception on {request.method} {request.url.path}: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal server error occurred while processing the request.",
            "error_code": "INTERNAL_SERVER_ERROR",
            "path": request.url.path
        }
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.detail,
            "error_code": f"HTTP_{exc.status_code}",
            "path": request.url.path
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "detail": "Invalid request payload or missing required parameters.",
            "errors": exc.errors(),
            "error_code": "VALIDATION_ERROR",
            "path": request.url.path
        }
    )


# Ensure uploads directory exists and mount static files
uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads"))
os.makedirs(uploads_dir, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

from app.api.v1.analytics import router as analytics_router

# Root /api/health endpoint
@app.get("/api/health", response_model=HealthResponse, tags=["health"])
async def root_health_check():
    return HealthResponse(status="ok", service="meikaan")

# Root /api/auth endpoints
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])

# Root /api/tickets endpoints
app.include_router(tickets_router, prefix="/api/tickets", tags=["tickets"])

# Root /api/tickets/{ticket_id}/evidence endpoints
app.include_router(evidence_router, prefix="/api/tickets", tags=["evidence"])

# Root /api/verification endpoints (/api/verification/start, /api/verification/{id}/submit)
app.include_router(verification_router, prefix="/api/verification", tags=["verification"])

# Root /api/analytics endpoints (/api/analytics/dashboard, /api/analytics/wards, /api/analytics/workers, /api/analytics/audit)
app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])

# Include API v1 router (/api/v1/*)
app.include_router(api_v1_router, prefix=settings.API_V1_STR)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
