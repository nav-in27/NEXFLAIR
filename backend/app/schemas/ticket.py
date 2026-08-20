from pydantic import BaseModel, Field
from typing import Optional, List
import datetime
from app.models.entities import TicketStatus

class TicketCreate(BaseModel):
    complaint_type: str = Field(default="STAGNANT_WATER", description="Primary complaint category")
    title: str = Field(..., min_length=3, max_length=255)
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    location_captured_at: Optional[datetime.datetime] = None
    location_source: Optional[str] = "device_gps"
    location_status: Optional[str] = "GPS_CAPTURED"
    ward_id: Optional[str] = None
    priority: str = Field(default="MEDIUM")

class TicketAssign(BaseModel):
    assigned_worker_id: str

class WorkerStartTaskRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    captured_at: Optional[datetime.datetime] = None
    location_source: Optional[str] = "device_gps"

class TicketStatusUpdate(BaseModel):
    status: TicketStatus

class WorkerBriefResponse(BaseModel):
    id: str
    worker_code: str
    full_name: str
    email: str

    class Config:
        from_attributes = True

class WardBriefResponse(BaseModel):
    id: str
    ward_number: int
    name: str
    zone: str

    class Config:
        from_attributes = True


class TicketEvidenceBriefResponse(BaseModel):
    id: str
    evidence_type: str
    source_type: str
    file_path: str
    uploaded_at: datetime.datetime

    class Config:
        from_attributes = True

class TicketResponse(BaseModel):
    id: str
    ticket_number: str
    complaint_type: str
    title: str
    description: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    location_captured_at: Optional[datetime.datetime] = None
    location_source: Optional[str] = None
    location_status: Optional[str] = None
    ward_id: str
    assigned_worker_id: Optional[str] = None
    worker_start_latitude: Optional[float] = None
    worker_start_longitude: Optional[float] = None
    worker_start_accuracy: Optional[float] = None
    worker_start_timestamp: Optional[datetime.datetime] = None
    status: str
    priority: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    ward: Optional[WardBriefResponse] = None
    assigned_worker: Optional[WorkerBriefResponse] = None
    evidences: Optional[List[TicketEvidenceBriefResponse]] = None

    class Config:
        from_attributes = True


class ReviewActionRequest(BaseModel):
    action: str = Field(..., description="APPROVE_CLOSURE, REQUEST_REVERIFICATION, or REOPEN_TICKET")
    comments: Optional[str] = None


class ReviewActionResponse(BaseModel):
    id: str
    ticket_id: str
    reviewer_id: str
    action: str
    comments: Optional[str] = None
    created_at: datetime.datetime

    class Config:
        from_attributes = True


class ReviewQueueItemResponse(BaseModel):
    ticket_id: str
    ticket_number: str
    complaint_type: str
    title: str
    status: str
    worker_id: Optional[str] = None
    worker_name: Optional[str] = None
    ward_name: Optional[str] = None
    integrity_score: Optional[float] = None
    decision: Optional[str] = None
    primary_concern: Optional[str] = None
    created_at: datetime.datetime
    verification_session_id: Optional[str] = None
    before_image_url: Optional[str] = None
    after_image_url: Optional[str] = None


class CitizenReportCreate(BaseModel):
    complaint_type: str = Field(default="STAGNANT_WATER")
    description: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    accuracy_meters: Optional[float] = None
    captured_at: Optional[datetime.datetime] = None
    location_source: Optional[str] = "device_gps"
    location_status: Optional[str] = "GPS_CAPTURED"
    ward_id: Optional[str] = None
    photo_base64: Optional[str] = None

class CitizenDisputeCreate(BaseModel):
    reason: str
    evidence_base64: Optional[str] = None

class CitizenTicketTrackResponse(BaseModel):
    ticket_id: str
    ticket_number: str
    complaint_type: str
    title: str
    description: Optional[str] = None
    status: str
    created_at: datetime.datetime
    updated_at: datetime.datetime
    ward_name: Optional[str] = None
    before_image_url: Optional[str] = None
    resolution_image_url: Optional[str] = None
    resolution_date: Optional[datetime.datetime] = None

