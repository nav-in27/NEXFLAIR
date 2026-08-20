import io
import os
import datetime
from typing import Optional
from PIL import Image
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models.entities import (
    Ticket, TicketEvidence, VerificationSession, VerificationResult, VerificationSignal,
    Worker, User, UserRole,
    EvidenceType, SourceType, TicketStatus
)
from app.schemas.verification import (
    VerificationStartRequest, VerificationSessionResponse,
    SceneAnalysisResponse, SceneSignalItem,
    HazardAnalysisResponse, HazardSignalItem,
    FreshnessAnalysisResponse, FreshnessSignalItem,
    SpatialTemporalAnalysisResponse, SpatialTemporalSignalItem,
    QualityAnalysisResponse, QualitySignalItem,
    FinalizeVerificationResponse, FusionSignalItem,
)
from app.api.deps import get_current_user
from app.services.evidence import (
    validate_evidence_file, compute_sha256_hash, compute_perceptual_hash
)
from app.services.storage import get_storage_provider

router = APIRouter()

SESSION_DURATION_MINUTES = 15

@router.post("/start", response_model=VerificationSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_verification_session(
    payload: VerificationStartRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Initiates an active verification session when a worker clicks RESOLVE TICKET:
    - Ticket status transitions from IN_PROGRESS -> PENDING_VERIFICATION
    - Creates a 15-minute expiring VerificationSession
    - Enforces worker assignment role check
    """
    ticket = db.query(Ticket).filter(Ticket.id == payload.ticket_id).first()
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Ticket not found."
        )

    # Worker Assignment Permission Check
    worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if current_user.role == UserRole.FIELD_WORKER:
        if not worker_rec or ticket.assigned_worker_id != worker_rec.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only the assigned field worker can initiate verification for this ticket."
            )
    else:
        # Admin or Reviewer initiating verification requires worker assigned to ticket
        if not ticket.assigned_worker_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start verification session for an unassigned ticket. Please assign a worker first."
            )
        worker_rec = db.query(Worker).filter(Worker.id == ticket.assigned_worker_id).first()

    now = datetime.datetime.now(datetime.timezone.utc)
    expires_at = now + datetime.timedelta(minutes=SESSION_DURATION_MINUTES)

    # Create active VerificationSession
    session = VerificationSession(
        ticket_id=ticket.id,
        worker_id=worker_rec.id,
        challenge_type="CAPTURE_AREA_VERIFICATION",
        challenge_text="Capture the reported area for verification.",
        status="IN_PROGRESS",
        started_at=now,
        expires_at=expires_at
    )
    db.add(session)

    # Transition ticket status to PENDING_VERIFICATION (do NOT mark CLOSED)
    ticket.status = TicketStatus.PENDING_VERIFICATION.value
    ticket.updated_at = now

    db.commit()
    db.refresh(session)
    return VerificationSessionResponse.model_validate(session)

@router.post("/{session_id}/submit", response_model=VerificationSessionResponse)
async def submit_verification_evidence(
    session_id: str,
    file: UploadFile = File(...),
    source_type: SourceType = Form(SourceType.UPLOAD),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    accuracy_meters: Optional[float] = Form(None),
    location_source: Optional[str] = Form("device_gps"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Submits live or demo upload evidence for an active VerificationSession:
    - Validates session expiration
    - Prevents duplicate submissions
    - Verifies worker match
    - Computes SHA-256 and Perceptual hashes
    """
    # 1. Fetch Session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification session not found."
        )

    # 2. Worker Match Validation
    worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if current_user.role == UserRole.FIELD_WORKER:
        if not worker_rec or session.worker_id != worker_rec.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Only the worker assigned to this verification session can submit evidence."
            )

    # 3. Check Duplicate Submission
    if session.status in ["SUBMITTED", "COMPLETED"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Duplicate submission error: This verification session has already been submitted."
        )

    # 4. Check Session Expiration
    now = datetime.datetime.now(datetime.timezone.utc)
    if now > session.expires_at.replace(tzinfo=datetime.timezone.utc) if session.expires_at.tzinfo is None else now > session.expires_at:
        session.status = "EXPIRED"
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification session has expired. Please start a new verification session."
        )

    # 5. Read and Validate Evidence File
    file_bytes = await file.read()
    filename = file.filename or "verification.jpg"
    content_type = file.content_type or "image/jpeg"

    width, height, _ = validate_evidence_file(file_bytes, filename, content_type)

    # 6. Generate SHA-256 and Perceptual Hashes
    sha256_hash = compute_sha256_hash(file_bytes)
    image_obj = Image.open(io.BytesIO(file_bytes))
    phash = compute_perceptual_hash(image_obj)

    # Save to storage
    storage = get_storage_provider()
    relative_path, _ = storage.save_file(file_bytes, filename, content_type)

    # 7. Create TicketEvidence Record
    evidence = TicketEvidence(
        ticket_id=session.ticket_id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        source_type=source_type.value,
        file_path=relative_path,
        file_type=content_type,
        sha256_hash=sha256_hash,
        perceptual_hash=phash,
        captured_at=now,
        uploaded_at=now,
        latitude=latitude,
        longitude=longitude,
        accuracy_meters=accuracy_meters,
        location_source=location_source or "device_gps",
        width=width,
        height=height,
        file_size_bytes=len(file_bytes),
        verification_session_id=session.id
    )
    db.add(evidence)
    db.commit()
    db.refresh(evidence)

    # 8. Compute Verification Results & Integrity Score via Evidence Fusion Engine
    session.evidence_id = evidence.id
    session.status = "SUBMITTED"
    db.commit()

    from app.services.integrity_scoring import get_integrity_scoring_service
    fusion_svc = get_integrity_scoring_service()
    final_res = fusion_svc.finalize_verification(db=db, session_id=session.id)

    db.refresh(session)
    res_dto = VerificationSessionResponse.model_validate(session)
    res_dto.integrity_score = final_res.overall_score
    res_dto.integrity_status = final_res.decision
    res_dto.detailed_result = final_res.detailed_result
    res_dto.signals = [
        {"signal_name": s.get("signal_name", ""), "signal_value": str(s.get("signal_value", "")), "confidence": float(s.get("confidence", 1.0))}
        for s in final_res.signals
    ]
    return res_dto

@router.get("/{session_id}", response_model=VerificationSessionResponse)
async def get_verification_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves verification session status and expiration metadata."""
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification session not found."
        )
    return VerificationSessionResponse.model_validate(session)


@router.post("/{session_id}/scene-analysis", response_model=SceneAnalysisResponse)
async def run_scene_analysis(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Scene Consistency Engine endpoint.

    Compares the BEFORE evidence image with the LIVE_VERIFICATION image
    submitted in the session. Produces a scene consistency score and
    stores signals in verification_signals.

    The score measures *visual scene similarity* – it does NOT prove
    the worker visited the location.
    """
    from app.services.scene_verification import get_scene_verification_service

    # 1. Fetch session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification session not found.")

    if session.status not in ("SUBMITTED", "IN_PROGRESS", "COMPLETED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run scene analysis on a session with status '{session.status}'."
        )

    # 2. Locate the BEFORE evidence for this ticket
    before_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.evidence_type == EvidenceType.BEFORE.value,
        )
        .order_by(TicketEvidence.created_at.asc())
        .first()
    )
    if not before_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No BEFORE evidence image found for this ticket. Upload complaint evidence first.",
        )

    # 3. Locate the verification (AFTER / LIVE_VERIFICATION) evidence
    verification_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.verification_session_id == session.id,
        )
        .first()
    )
    if not verification_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification evidence image found for this session. Submit evidence first.",
        )

    # 4. Resolve file paths
    storage = get_storage_provider()
    before_path = storage.get_file_path(before_evidence.file_path)
    after_path = storage.get_file_path(verification_evidence.file_path)

    if not os.path.isfile(before_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BEFORE evidence image file missing from storage.")
    if not os.path.isfile(after_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification evidence image file missing from storage.")

    # 5. Run Scene Verification Service
    svc = get_scene_verification_service()
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    viz_dir = os.path.join(backend_dir, "uploads", "visualizations")

    result = svc.analyze(
        before_image=before_path,
        after_image=after_path,
        visualization_dir=viz_dir,
        session_id=session_id,
    )

    # 6. Persist VerificationResult
    integrity_status = "CONSISTENT" if result.scene_score >= 15.0 else "INCONSISTENT"
    vr = VerificationResult(
        session_id=session.id,
        integrity_score=result.scene_score,
        integrity_status=integrity_status,
        ela_score=None,
        exif_valid=True,
    )
    db.add(vr)
    db.commit()
    db.refresh(vr)

    # 7. Persist VerificationSignals
    for sig in result.signals:
        vs = VerificationSignal(
            result_id=vr.id,
            signal_name=sig["signal_name"],
            signal_value=sig["signal_value"],
            confidence=sig["confidence"],
        )
        db.add(vs)
    db.commit()

    # 8. Build visualization URL (relative to static mount)
    viz_url = None
    if result.visualization_path and os.path.isfile(result.visualization_path):
        viz_url = f"/uploads/visualizations/scene_match_{session_id}.png"

    return SceneAnalysisResponse(
        session_id=session_id,
        keypoints_before=result.keypoints_before,
        keypoints_after=result.keypoints_after,
        matches=result.matches,
        valid_matches=result.valid_matches,
        match_ratio=result.match_ratio,
        scene_score=result.scene_score,
        method_used=result.method_used,
        inference_time_ms=result.inference_time_ms,
        visualization_url=viz_url,
        error=result.error,
        signals=[SceneSignalItem(**s) for s in result.signals],
    )


@router.post("/{session_id}/hazard-analysis", response_model=HazardAnalysisResponse)
async def run_hazard_analysis(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Hazard Change Engine Endpoint.

    Detects stagnant water hazard in the BEFORE image and AFTER/LIVE_VERIFICATION
    image to compute the visual hazard-area reduction percentage and resolution score.

    Performs automatic routing toward HUMAN_REVIEW if confidence is insufficient
    or if no hazard was present in the complaint image.
    """
    from app.services.hazard_detection import get_hazard_detection_service

    # 1. Fetch verification session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification session not found.")

    if session.status not in ("SUBMITTED", "IN_PROGRESS", "COMPLETED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run hazard analysis on a session with status '{session.status}'."
        )

    # 2. Locate BEFORE evidence for ticket
    before_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.evidence_type == EvidenceType.BEFORE.value,
        )
        .order_by(TicketEvidence.created_at.asc())
        .first()
    )
    if not before_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No BEFORE evidence image found for this ticket.",
        )

    # 3. Locate verification (AFTER / LIVE_VERIFICATION) evidence
    verification_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.verification_session_id == session.id,
        )
        .first()
    )
    if not verification_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification evidence image found for this session.",
        )

    # 4. Resolve absolute paths
    storage = get_storage_provider()
    before_path = storage.get_file_path(before_evidence.file_path)
    after_path = storage.get_file_path(verification_evidence.file_path)

    if not os.path.isfile(before_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="BEFORE evidence image file missing from storage.")
    if not os.path.isfile(after_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification evidence image file missing from storage.")

    # 5. Run Hazard Detection Service
    svc = get_hazard_detection_service()
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    viz_dir = os.path.join(backend_dir, "uploads", "visualizations")

    # Get primary complaint type from ticket if set
    ticket = db.query(Ticket).filter(Ticket.id == session.ticket_id).first()
    hazard_type = ticket.complaint_type if ticket and ticket.complaint_type else "STAGNANT_WATER"

    result = svc.analyze(
        before_image=before_path,
        after_image=after_path,
        hazard_type=hazard_type,
        visualization_dir=viz_dir,
        session_id=session_id,
    )

    # 6. Find or create VerificationResult for this session
    vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
    if not vr:
        integrity_status = "CONSISTENT" if not result.requires_human_review else "HUMAN_REVIEW"
        vr = VerificationResult(
            session_id=session.id,
            integrity_score=result.hazard_resolution_score,
            integrity_status=integrity_status,
            ela_score=None,
            exif_valid=True,
        )
        db.add(vr)
        db.commit()
        db.refresh(vr)

    # 7. Persist hazard signals in verification_signals table
    for sig in result.signals:
        vs = VerificationSignal(
            result_id=vr.id,
            signal_name=sig["signal_name"],
            signal_value=sig["signal_value"],
            confidence=sig["confidence"],
        )
        db.add(vs)
    db.commit()

    # 8. Build visualization URL
    viz_url = None
    if result.visualization_path and os.path.isfile(result.visualization_path):
        viz_url = f"/uploads/visualizations/hazard_change_{session_id}.png"

    return HazardAnalysisResponse(
        session_id=session_id,
        hazard_type=result.hazard_type,
        before_hazard_area=result.before_hazard_area,
        after_hazard_area=result.after_hazard_area,
        hazard_reduction_percentage=result.hazard_reduction_percentage,
        hazard_resolution_score=result.hazard_resolution_score,
        confidence=result.confidence,
        method_used=result.method_used,
        inference_time_ms=result.inference_time_ms,
        requires_human_review=result.requires_human_review,
        review_reason=result.review_reason,
        visualization_url=viz_url,
        error=result.error,
        signals=[HazardSignalItem(**s) for s in result.signals],
    )


@router.post("/{session_id}/freshness-analysis", response_model=FreshnessAnalysisResponse)
async def run_freshness_analysis(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evidence Freshness Engine Endpoint.

    Evaluates whether submitted verification evidence appears fresh and specific
    to the active verification session by analyzing SHA-256 exact duplicates,
    Perceptual Hash near-duplicates, capture timestamp deltas, and session binding.
    """
    from app.services.freshness_service import get_evidence_freshness_service

    # 1. Fetch verification session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification session not found.")

    if session.status not in ("SUBMITTED", "IN_PROGRESS", "COMPLETED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run freshness analysis on a session with status '{session.status}'."
        )

    # 2. Locate submitted evidence for this session
    verification_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.verification_session_id == session.id,
        )
        .first()
    )
    if not verification_evidence:
        # Fallback to evidence linked via session.evidence_id
        if session.evidence_id:
            verification_evidence = db.query(TicketEvidence).filter(TicketEvidence.id == session.evidence_id).first()

    if not verification_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification evidence record found for this session.",
        )

    # 3. Execute Evidence Freshness Service
    svc = get_evidence_freshness_service()
    result = svc.analyze_freshness(
        db=db,
        session_id=session_id,
        current_evidence=verification_evidence,
    )

    # 4. Find or create VerificationResult record for session
    vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
    if not vr:
        integrity_status = "CONSISTENT" if not result.reuse_detected else "SUSPICIOUS"
        vr = VerificationResult(
            session_id=session.id,
            integrity_score=result.freshness_score,
            integrity_status=integrity_status,
            ela_score=None,
            exif_valid=not result.missing_capture_timestamp,
        )
        db.add(vr)
        db.commit()
        db.refresh(vr)

    # 5. Persist freshness signals in verification_signals table
    for sig in result.signals:
        vs = VerificationSignal(
            result_id=vr.id,
            signal_name=sig["signal_name"],
            signal_value=sig["signal_value"],
            confidence=sig["confidence"],
        )
        db.add(vs)
    db.commit()

    return FreshnessAnalysisResponse(
        session_id=session_id,
        freshness_score=result.freshness_score,
        reuse_detected=result.reuse_detected,
        is_exact_duplicate=result.is_exact_duplicate,
        is_near_duplicate=result.is_near_duplicate,
        is_suspiciously_old=result.is_suspiciously_old,
        missing_capture_timestamp=result.missing_capture_timestamp,
        matched_evidence_id=result.matched_evidence_id,
        explanation=result.explanation,
        inference_time_ms=result.inference_time_ms,
        signals=[FreshnessSignalItem(**s) for s in result.signals],
    )


@router.post("/{session_id}/spatial-temporal-analysis", response_model=SpatialTemporalAnalysisResponse)
async def run_spatial_temporal_analysis(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Spatial and Temporal Consistency Analysis Endpoint.

    Calculates Haversine distance between complaint GPS and verification evidence GPS.
    Evaluates worker task velocity to identify Spatio-Temporal Anomalies.
    """
    from app.services.spatial_temporal import get_temporal_consistency_service

    # 1. Fetch verification session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification session not found.")

    if session.status not in ("SUBMITTED", "IN_PROGRESS", "COMPLETED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run spatial-temporal analysis on a session with status '{session.status}'."
        )

    # 2. Execute Temporal Consistency Service
    svc = get_temporal_consistency_service()
    result = svc.analyze(db=db, session_id=session_id)

    # 3. Find or create VerificationResult for session
    vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
    if not vr:
        integrity_status = "CONSISTENT" if not result.is_spatio_temporal_anomaly else "SUSPICIOUS"
        vr = VerificationResult(
            session_id=session.id,
            integrity_score=result.spatial_score,
            integrity_status=integrity_status,
            ela_score=None,
            exif_valid=not result.low_confidence,
        )
        db.add(vr)
        db.commit()
        db.refresh(vr)

    # 4. Persist signals in verification_signals table
    for sig in result.signals:
        vs = VerificationSignal(
            result_id=vr.id,
            signal_name=sig["signal_name"],
            signal_value=sig["signal_value"],
            confidence=sig["confidence"],
        )
        db.add(vs)
    db.commit()

    return SpatialTemporalAnalysisResponse(
        session_id=session_id,
        spatial_score=result.spatial_score,
        distance_meters=result.distance_meters,
        observed_speed_kmh=result.observed_speed_kmh,
        is_spatio_temporal_anomaly=result.is_spatio_temporal_anomaly,
        low_confidence=result.low_confidence,
        confidence=result.confidence,
        explanation=result.explanation,
        inference_time_ms=result.inference_time_ms,
        signals=[SpatialTemporalSignalItem(**s) for s in result.signals],
    )


@router.post("/{session_id}/quality-analysis", response_model=QualityAnalysisResponse)
async def run_quality_analysis(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evidence Quality Analysis Endpoint.

    Evaluates image resolution, blur, darkness/brightness, camera obstruction,
    and aspect ratio cropping. If visual quality is insufficient, flags for
    HUMAN_REVIEW_REQUIRED without accusing worker of suspicious intent.
    """
    from app.services.quality_service import get_evidence_quality_service

    # 1. Fetch verification session
    session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification session not found.")

    if session.status not in ("SUBMITTED", "IN_PROGRESS", "COMPLETED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot run quality analysis on a session with status '{session.status}'."
        )

    # 2. Fetch verification evidence for session
    verification_evidence = (
        db.query(TicketEvidence)
        .filter(
            TicketEvidence.ticket_id == session.ticket_id,
            TicketEvidence.verification_session_id == session.id,
        )
        .first()
    )
    if not verification_evidence and session.evidence_id:
        verification_evidence = db.query(TicketEvidence).filter(TicketEvidence.id == session.evidence_id).first()

    if not verification_evidence:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification evidence record found for this session.",
        )

    # 3. Resolve absolute file path
    storage = get_storage_provider()
    file_path = storage.get_file_path(verification_evidence.file_path)
    if not os.path.isfile(file_path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification evidence image file missing from storage.")

    # 4. Execute Evidence Quality Service
    svc = get_evidence_quality_service()
    result = svc.analyze(file_path)

    # 5. Find or create VerificationResult record for session
    vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
    if not vr:
        integrity_status = "CONSISTENT" if not result.human_review_required else "HUMAN_REVIEW"
        vr = VerificationResult(
            session_id=session.id,
            integrity_score=result.quality_score,
            integrity_status=integrity_status,
            ela_score=None,
            exif_valid=True,
        )
        db.add(vr)
        db.commit()
        db.refresh(vr)

    # 6. Persist signals in verification_signals table
    for sig in result.signals:
        vs = VerificationSignal(
            result_id=vr.id,
            signal_name=sig["signal_name"],
            signal_value=sig["signal_value"],
            confidence=sig["confidence"],
        )
        db.add(vs)
    db.commit()

    return QualityAnalysisResponse(
        session_id=session_id,
        quality_score=result.quality_score,
        quality_flags=result.quality_flags,
        explanation=result.explanation,
        human_review_required=result.human_review_required,
        review_reason=result.review_reason,
        width=result.width,
        height=result.height,
        blur_score=result.blur_score,
        brightness_score=result.brightness_score,
        inference_time_ms=result.inference_time_ms,
        signals=[QualitySignalItem(**s) for s in result.signals],
    )


@router.post("/{session_id}/finalize", response_model=FinalizeVerificationResponse)
async def finalize_verification(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Evidence Fusion Engine Finalize Endpoint.

    Fuses all constituent verification engines into an overall integrity score,
    weighted confidence level, and automated decision (VERIFIED, HUMAN_REVIEW, SUSPICIOUS).
    Updates ticket status accordingly and records complete results & signals in database.
    """
    from app.services.integrity_scoring import get_integrity_scoring_service

    svc = get_integrity_scoring_service()
    result = svc.finalize_verification(db=db, session_id=session_id)

    return FinalizeVerificationResponse(
        session_id=session_id,
        overall_score=result.overall_score,
        confidence=result.confidence,
        decision=result.decision,
        explanation=result.explanation,
        detailed_result=result.detailed_result,
        inference_time_ms=result.inference_time_ms,
        sub_scores=result.sub_scores,
        signals=[FusionSignalItem(**s) for s in result.signals],
    )






