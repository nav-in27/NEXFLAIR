import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "MEIKAAN — Civic Evidence Integrity Engine"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "meikaan-civic-integrity-secret-key-2026")
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./meikaan.db")
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "../uploads")
    MAX_FILE_SIZE_MB: int = 50
    
    class Config:
        case_sensitive = True

settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
