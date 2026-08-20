import uuid
import enum
from sqlalchemy import (
    Column, String, Integer, Float, DateTime, JSON, Text, Boolean, Enum as SQLEnum, ForeignKey, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    FIELD_WORKER = "FIELD_WORKER"
    REVIEWER = "REVIEWER"

class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    PENDING_VERIFICATION = "PENDING_VERIFICATION"
    VERIFIED = "VERIFIED"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    SUSPICIOUS = "SUSPICIOUS"
    CLOSURE_NOT_VERIFIED = "CLOSURE_NOT_VERIFIED"
    CITIZEN_CONFIRMED = "CITIZEN_CONFIRMED"
    CITIZEN_DISPUTE = "CITIZEN_DISPUTE"
    CLOSED = "CLOSED"

class EvidenceType(str, enum.Enum):
    BEFORE = "BEFORE"
    AFTER = "AFTER"
    LIVE_VERIFICATION = "LIVE_VERIFICATION"

class SourceType(str, enum.Enum):
    UPLOAD = "UPLOAD"
    LIVE_CAMERA = "LIVE_CAMERA"

class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole, name="user_role_enum"), nullable=False, default=UserRole.FIELD_WORKER, index=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    worker_profile = relationship("Worker", back_populates="user", uselist=False)
    review_actions = relationship("ReviewAction", back_populates="reviewer")
    audit_logs = relationship("AuditLog", back_populates="user")

class Ward(Base):
    __tablename__ = "wards"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ward_number = Column(Integer, unique=True, index=True, nullable=False)
    name = Column(String(255), nullable=False)
    zone = Column(String(100), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    workers = relationship("Worker", back_populates="ward")
    tickets = relationship("Ticket", back_populates="ward")

class Worker(Base):
    __tablename__ = "workers"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    ward_id = Column(String(36), ForeignKey("wards.id", ondelete="SET NULL"), nullable=True)
    worker_code = Column(String(50), unique=True, index=True, nullable=False)
    status = Column(String(50), default="ACTIVE", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="worker_profile")
    ward = relationship("Ward", back_populates="workers")
    assigned_tickets = relationship("Ticket", back_populates="assigned_worker")
    activities = relationship("WorkerActivity", back_populates="worker")

class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_number = Column(String(100), unique=True, index=True, nullable=False)
    complaint_type = Column(String(100), default="STAGNANT_WATER", nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    ward_id = Column(String(36), ForeignKey("wards.id", ondelete="RESTRICT"), nullable=False)
    assigned_worker_id = Column(String(36), ForeignKey("workers.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default=TicketStatus.OPEN.value, index=True, nullable=False)
    priority = Column(String(50), default="MEDIUM", nullable=False)

    # Location & Ward Capture Metadata
    accuracy_meters = Column(Float, nullable=True)
    location_captured_at = Column(DateTime(timezone=True), nullable=True)
    location_source = Column(String(50), default="device_gps", nullable=True)
    location_status = Column(String(50), default="GPS_CAPTURED", nullable=True)
    ward_derived_from = Column(String(50), default="gps_polygon", nullable=True)

    # Worker Task Start Location Metadata
    worker_start_latitude = Column(Float, nullable=True)
    worker_start_longitude = Column(Float, nullable=True)
    worker_start_accuracy = Column(Float, nullable=True)
    worker_start_timestamp = Column(DateTime(timezone=True), nullable=True)

    # Immutable Complaint Location Correction Audit Trail
    location_corrected_by = Column(String(36), nullable=True)
    location_corrected_at = Column(DateTime(timezone=True), nullable=True)
    location_correction_reason = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    ward = relationship("Ward", back_populates="tickets")
    assigned_worker = relationship("Worker", back_populates="assigned_tickets")
    evidences = relationship("TicketEvidence", back_populates="ticket")
    review_actions = relationship("ReviewAction", back_populates="ticket")

class TicketEvidence(Base):
    __tablename__ = "ticket_evidence"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    evidence_type = Column(String(50), default=EvidenceType.BEFORE.value, nullable=False, index=True)
    source_type = Column(String(50), default=SourceType.UPLOAD.value, nullable=False, index=True)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)
    sha256_hash = Column(String(64), index=True, nullable=False)
    perceptual_hash = Column(String(64), index=True, nullable=True)
    captured_at = Column(DateTime(timezone=True), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    accuracy_meters = Column(Float, nullable=True)
    location_source = Column(String(50), default="device_gps", nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    file_size_bytes = Column(Integer, nullable=True)
    verification_session_id = Column(String(36), ForeignKey("verification_sessions.id", ondelete="SET NULL"), nullable=True)

    ticket = relationship("Ticket", back_populates="evidences")
    verification_session = relationship("VerificationSession", foreign_keys=[verification_session_id])

class VerificationSession(Base):
    __tablename__ = "verification_sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    evidence_id = Column(String(36), ForeignKey("ticket_evidence.id", ondelete="SET NULL"), nullable=True)
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    worker_id = Column(String(36), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)
    challenge_type = Column(String(100), default="CAPTURE_AREA_VERIFICATION", nullable=False)
    challenge_text = Column(String(255), default="Capture the reported area for verification.", nullable=False)
    status = Column(String(50), default="IN_PROGRESS", nullable=False, index=True)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    evidence = relationship("TicketEvidence", foreign_keys=[evidence_id])
    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    worker = relationship("Worker", foreign_keys=[worker_id])
    results = relationship("VerificationResult", back_populates="session")

class VerificationResult(Base):
    __tablename__ = "verification_results"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    session_id = Column(String(36), ForeignKey("verification_sessions.id", ondelete="CASCADE"), nullable=False)
    integrity_score = Column(Float, nullable=False)
    integrity_status = Column(String(50), nullable=False)
    ela_score = Column(Float, nullable=True)
    exif_valid = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    session = relationship("VerificationSession", back_populates="results")
    signals = relationship("VerificationSignal", back_populates="result")

class VerificationSignal(Base):
    __tablename__ = "verification_signals"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    result_id = Column(String(36), ForeignKey("verification_results.id", ondelete="CASCADE"), nullable=False)
    signal_name = Column(String(100), nullable=False)
    signal_value = Column(String(255), nullable=False)
    confidence = Column(Float, default=1.0, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    result = relationship("VerificationResult", back_populates="signals")

class ReviewAction(Base):
    __tablename__ = "review_actions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False)
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    action = Column(String(50), nullable=False)
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ticket = relationship("Ticket", back_populates="review_actions")
    reviewer = relationship("User", back_populates="review_actions")

class WorkerActivity(Base):
    __tablename__ = "worker_activity"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    worker_id = Column(String(36), ForeignKey("workers.id", ondelete="CASCADE"), nullable=False)
    activity_type = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    worker = relationship("Worker", back_populates="activities")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(100), nullable=False)
    resource = Column(String(100), nullable=False)
    details = Column(JSON, nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="audit_logs")

class CitizenDispute(Base):
    __tablename__ = "citizen_disputes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    ticket_id = Column(String(36), ForeignKey("tickets.id", ondelete="CASCADE"), nullable=False, index=True)
    citizen_reference = Column(String(100), nullable=True)
    reason = Column(Text, nullable=False)
    evidence_id = Column(String(36), ForeignKey("ticket_evidence.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), default="OPEN", nullable=False, index=True) # OPEN, UNDER_REVIEW, CONFIRMED, REOPENED, REJECTED
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    reviewer_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolution = Column(Text, nullable=True)

    ticket = relationship("Ticket", foreign_keys=[ticket_id])
    evidence = relationship("TicketEvidence", foreign_keys=[evidence_id])
    reviewer = relationship("User", foreign_keys=[reviewer_id])

