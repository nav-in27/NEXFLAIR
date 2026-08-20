import io
import datetime
from typing import List, Optional
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import (
    Ticket, TicketEvidence, VerificationSession, Worker, User, UserRole,
    EvidenceType, SourceType, TicketStatus
)
from app.schemas.evidence import EvidenceResponse
from app.api.deps import get_current_user
from app.services.evidence import (
    validate_evidence_file, compute_sha256_hash, compute_perceptual_hash
)
from app.services.storage import get_storage_provider

router = APIRouter()

@router.post("/{ticket_id}/evidence", response_model=EvidenceResponse, status_code=status.HTTP_201_CREATED)
async def upload_ticket_evidence(
    ticket_id: str,
    file: UploadFile = File(...),
    evidence_type: EvidenceType = Form(EvidenceType.BEFORE),
    source_type: SourceType = Form(SourceType.UPLOAD),
    captured_at: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Uploads evidence for a municipal ticket:
    - Supports BEFORE, AFTER, LIVE_VERIFICATION
    - Supports UPLOAD, LIVE_CAMERA
    - Generates SHA-256 and Perceptual hashes
    - Enforces role access (Worker must be assigned to ticket)
    - Validates file MIME, size, dimensions, path safety
    - Creates VerificationSession in PENDING status
    """
    # 1. Fetch Ticket
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found."
        )

    # 2. Enforce Role Permissions
    worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if current_user.role == UserRole.FIELD_WORKER:
        if not worker_rec or ticket.assigned_worker_id != worker_rec.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Field workers can only upload evidence to assigned tickets."
            )

    worker_id_for_session = ticket.assigned_worker_id or (worker_rec.id if worker_rec else None)
    if not worker_id_for_session:
        first_worker = db.query(Worker).first()
        if first_worker:
            worker_id_for_session = first_worker.id

    # 3. Read and Validate File Bytes
    file_bytes = await file.read()
    filename = file.filename or "evidence.jpg"
    content_type = file.content_type or "image/jpeg"

    width, height, img_fmt = validate_evidence_file(file_bytes, filename, content_type)

    # 4. Generate SHA-256 and Perceptual Hashes
    sha256_hash = compute_sha256_hash(file_bytes)

    # Duplicate check on same ticket
    duplicate = db.query(TicketEvidence).filter(
        TicketEvidence.ticket_id == ticket_id,
        TicketEvidence.sha256_hash == sha256_hash
    ).first()
    if duplicate:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate file detected. An identical evidence image has already been submitted for this ticket."
        )

    image_obj = Image.open(io.BytesIO(file_bytes))
    phash = compute_perceptual_hash(image_obj)

    # 5. Save File via Storage Abstraction
    storage = get_storage_provider()
    relative_path, storage_key = storage.save_file(file_bytes, filename, content_type)

    # Parse captured_at timestamp
    parsed_captured_at = None
    if captured_at:
        try:
            parsed_captured_at = datetime.datetime.fromisoformat(captured_at.replace("Z", "+00:00"))
        except Exception:
            parsed_captured_at = datetime.datetime.now(datetime.timezone.utc)

    # 6. Create Database Records
    evidence = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=evidence_type.value,
        source_type=source_type.value,
        file_path=relative_path,
        file_type=content_type,
        sha256_hash=sha256_hash,
        perceptual_hash=phash,
        captured_at=parsed_captured_at or datetime.datetime.now(datetime.timezone.utc),
        latitude=latitude or ticket.latitude,
        longitude=longitude or ticket.longitude,
        width=width,
        height=height,
        file_size_bytes=len(file_bytes)
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # 7. Create VerificationSession in PENDING state if worker ID is available
    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(minutes=15)

    if worker_id_for_session:
        session = VerificationSession(
            evidence_id=evidence.id,
            ticket_id=ticket.id,
            worker_id=worker_id_for_session,
            status="PENDING",
            started_at=now,
            expires_at=expires_at
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        evidence.verification_session_id = session.id

    # Update ticket status to PENDING_VERIFICATION if currently IN_PROGRESS / ASSIGNED / OPEN
    if ticket.status in [TicketStatus.OPEN.value, TicketStatus.ASSIGNED.value, TicketStatus.IN_PROGRESS.value]:
        ticket.status = TicketStatus.PENDING_VERIFICATION.value
    ticket.updated_at = now

    db.commit()
    db.refresh(evidence)

    return EvidenceResponse.model_validate(evidence)

@router.get("/{ticket_id}/evidence", response_model=List[EvidenceResponse])
async def list_ticket_evidence(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all evidence files for a ticket."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found."
        )

    if current_user.role == UserRole.FIELD_WORKER:
        worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
        if not worker_rec or ticket.assigned_worker_id != worker_rec.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Field workers can only access evidence for assigned tickets."
            )

    evidences = db.query(TicketEvidence).filter(TicketEvidence.ticket_id == ticket_id).all()
    return [EvidenceResponse.model_validate(e) for e in evidences]
