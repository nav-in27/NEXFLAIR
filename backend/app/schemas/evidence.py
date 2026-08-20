from pydantic import BaseModel
from typing import Optional, Dict, Any, List
import datetime

class EvidenceResponse(BaseModel):
    id: str
    ticket_id: str
    evidence_type: str
    source_type: str
    file_path: str
    file_type: str
    sha256_hash: str
    perceptual_hash: Optional[str] = None
    captured_at: Optional[datetime.datetime] = None
    uploaded_at: datetime.datetime
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    width: Optional[int] = None
    height: Optional[int] = None
    file_size_bytes: Optional[int] = None
    verification_session_id: Optional[str] = None

    class Config:
        from_attributes = True

class EvidenceVerifyRequest(BaseModel):
    evidence_id: str

class EvidenceVerifyResponse(BaseModel):
    status: str
    integrity_score: float
    details: Optional[Dict[str, Any]] = None

# Aliases for backwards compatibility
EvidenceUploadResponse = EvidenceResponse
VerificationResponse = EvidenceVerifyResponse
