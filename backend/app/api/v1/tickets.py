from typing import List, Optional
import random
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.db.session import get_db
from app.models.entities import (
    Ticket, Worker, Ward, User, UserRole, TicketStatus,
    ReviewAction, AuditLog, VerificationSession, VerificationResult, VerificationSignal,
    TicketEvidence, EvidenceType, SourceType, CitizenDispute,
)
from app.schemas.ticket import (
    TicketCreate, TicketResponse, TicketAssign, TicketStatusUpdate,
    WardBriefResponse, WorkerBriefResponse,
    ReviewActionRequest, ReviewActionResponse, ReviewQueueItemResponse,
    CitizenReportCreate, CitizenDisputeCreate, WorkerStartTaskRequest,
)
from app.api.deps import get_current_user, require_role
from app.services.ward_lookup import get_ward_lookup_service

router = APIRouter()

def _format_ticket_response(ticket: Ticket) -> TicketResponse:
    ward_brief = None
    if ticket.ward:
        ward_brief = WardBriefResponse(
            id=ticket.ward.id,
            ward_number=ticket.ward.ward_number,
            name=ticket.ward.name,
            zone=ticket.ward.zone
        )

    worker_brief = None
    if ticket.assigned_worker and ticket.assigned_worker.user:
        worker_brief = WorkerBriefResponse(
            id=ticket.assigned_worker.id,
            worker_code=ticket.assigned_worker.worker_code,
            full_name=ticket.assigned_worker.user.full_name,
            email=ticket.assigned_worker.user.email
        )

    return TicketResponse(
        id=ticket.id,
        ticket_number=ticket.ticket_number,
        complaint_type=ticket.complaint_type,
        title=ticket.title,
        description=ticket.description,
        latitude=ticket.latitude,
        longitude=ticket.longitude,
        accuracy_meters=ticket.accuracy_meters,
        location_captured_at=ticket.location_captured_at,
        location_source=ticket.location_source,
        location_status=ticket.location_status,
        ward_id=ticket.ward_id,
        assigned_worker_id=ticket.assigned_worker_id,
        worker_start_latitude=ticket.worker_start_latitude,
        worker_start_longitude=ticket.worker_start_longitude,
        worker_start_accuracy=ticket.worker_start_accuracy,
        worker_start_timestamp=ticket.worker_start_timestamp,
        status=ticket.status,
        priority=ticket.priority,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        ward=ward_brief,
        assigned_worker=worker_brief
    )

@router.post("", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
async def create_ticket(
    payload: TicketCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Creates a new municipal ticket with server-side Point-in-Polygon Ward lookup."""
    ward_lookup = get_ward_lookup_service()
    derived_info = ward_lookup.resolve_ward(payload.latitude, payload.longitude)

    # Resolve DB Ward from derived ward number or provided ward_id
    ward = None
    if derived_info.get("ward_number"):
        ward = db.query(Ward).filter(Ward.ward_number == derived_info["ward_number"]).first()

    if not ward and payload.ward_id:
        ward = db.query(Ward).filter(Ward.id == payload.ward_id).first()

    if not ward:
        ward = db.query(Ward).first()

    if not ward:
        ward = Ward(
            ward_number=derived_info.get("ward_number") or 14,
            name=derived_info.get("ward_name") or "Ward 14 - Malleshwaram",
            zone=derived_info.get("zone") or "North Zone"
        )
        db.add(ward)
        db.commit()
        db.refresh(ward)

    rand_suffix = random.randint(1000, 9999)
    ticket_num = f"TKT-2026-{rand_suffix}"

    now = datetime.datetime.now(datetime.timezone.utc)
    new_ticket = Ticket(
        ticket_number=ticket_num,
        complaint_type=payload.complaint_type,
        title=payload.title,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        location_captured_at=payload.location_captured_at or now,
        location_source=payload.location_source or "device_gps",
        location_status=payload.location_status or ("GPS_CAPTURED" if payload.latitude and payload.longitude else "GPS_UNAVAILABLE"),
        ward_derived_from=derived_info.get("derived_from", "gps_polygon"),
        ward_id=ward.id,
        priority=payload.priority,
        status=TicketStatus.OPEN.value
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)

    return _format_ticket_response(new_ticket)

@router.get("", response_model=List[TicketResponse])
@router.get("/", response_model=List[TicketResponse])
async def list_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lists municipal tickets with role-based filtering:
    - ADMIN & REVIEWER: view all tickets
    - FIELD_WORKER: view assigned tickets only
    """
    query = db.query(Ticket).options(
        joinedload(Ticket.ward),
        joinedload(Ticket.assigned_worker).joinedload(Worker.user)
    )

    if current_user.role == UserRole.FIELD_WORKER:
        worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
        if not worker_rec:
            return []
        query = query.filter(Ticket.assigned_worker_id == worker_rec.id)

    tickets = query.order_by(Ticket.created_at.desc()).all()
    return [_format_ticket_response(t) for t in tickets]


@router.get("/demo-4821")
async def get_demo_ticket_4821(
    db: Session = Depends(get_db)
):
    """
    Primary Hackathon Judging Demo Endpoint.
    Returns the exact complete evidence investigation payload for Ticket #4821.
    """
    import os
    from app.services.demo_seeder import generate_demo_assets
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
    generate_demo_assets(base_dir)

    return {
        "ticket_id": "demo-tkt-4821",
        "ticket_number": "TKT-2026-4821",
        "ticket_code_display": "TKT #4821",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 14",
        "ward_details": "Ward 14 - Malleshwaram",
        "worker_name": "Ramesh Kumar (WRK-001)",
        "before_image_url": "/uploads/evidence/before_4821.jpg",
        "verification_image_url": "/uploads/evidence/verification_4821.jpg",
        "scene_viz_url": "/uploads/visualizations/scene_match_4821.png",
        "hazard_viz_url": "/uploads/visualizations/hazard_change_4821.png",
        "scene_consistency": 94,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 2100,
        "visual_reduction_pct": 83.2,
        "signals": {
          "scene": 94,
          "hazard": 91,
          "live_capture": 97,
          "spatial": 89,
          "temporal": 93,
          "freshness": 98,
          "quality": 95
        },
        "overall_score": 93,
        "decision": "VERIFIED",
        "explanation": "The submitted evidence is visually consistent with the original scene and shows substantial reduction of the reported stagnant-water area."
    }



@router.get("/demo-scenarios")
async def get_demo_scenarios():
    """
    Returns list of all 6 deterministic hackathon verification scenarios.
    """
    from app.services.demo_scenarios import get_all_scenarios
    return get_all_scenarios()


@router.get("/demo-scenarios/{scenario_id}")
async def get_demo_scenario_by_id(scenario_id: str):
    """
    Returns specific deterministic hackathon verification scenario payload.
    """
    from app.services.demo_scenarios import get_scenario_by_id
    return get_scenario_by_id(scenario_id)


@router.get("/review-queue", response_model=List[ReviewQueueItemResponse])
async def get_review_queue(

    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Retrieves the Review Queue listing tickets that require manual inspection.
    Allowed roles: ADMIN, REVIEWER. Field workers are denied access (HTTP 403).
    """
    # Query tickets in HUMAN_REVIEW, SUSPICIOUS, or PENDING_VERIFICATION status
    tickets = (
        db.query(Ticket)
        .options(
            joinedload(Ticket.ward),
            joinedload(Ticket.assigned_worker).joinedload(Worker.user)
        )
        .filter(Ticket.status.in_([TicketStatus.HUMAN_REVIEW.value, TicketStatus.SUSPICIOUS.value, TicketStatus.PENDING_VERIFICATION.value]))
        .order_by(Ticket.updated_at.desc())
        .all()
    )

    result_items = []
    for t in tickets:
        # Find latest verification session for ticket
        session = (
            db.query(VerificationSession)
            .filter(VerificationSession.ticket_id == t.id)
            .order_by(VerificationSession.started_at.desc())
            .first()
        )
        score = None
        decision = None
        explanation = None

        if session:
            vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
            if vr:
                score = vr.integrity_score
                decision = vr.integrity_status

            explanation_sig = (
                db.query(VerificationSignal)
                .filter(VerificationSignal.result_id == vr.id, VerificationSignal.signal_name == "fusion_explanation")
                .first() if vr else None
            )
            if explanation_sig:
                explanation = explanation_sig.signal_value

        worker_name = t.assigned_worker.user.full_name if t.assigned_worker and t.assigned_worker.user else "Unassigned"
        ward_name = t.ward.name if t.ward else "Unassigned Ward"

        result_items.append(ReviewQueueItemResponse(
            ticket_id=t.id,
            ticket_number=t.ticket_number,
            complaint_type=t.complaint_type,
            title=t.title,
            status=t.status,
            worker_id=t.assigned_worker_id,
            worker_name=worker_name,
            ward_name=ward_name,
            integrity_score=score,
            decision=decision,
            primary_concern=explanation or f"Ticket status is {t.status}",
            created_at=t.created_at,
            verification_session_id=session.id if session else None,
        ))

    return result_items


@router.get("/{ticket_id}", response_model=TicketResponse)
async def get_ticket_by_id(
    ticket_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retrieves detailed info for a single ticket.
    Enforces role restriction: Field workers can only access assigned tickets.
    """
    ticket = db.query(Ticket).options(
        joinedload(Ticket.ward),
        joinedload(Ticket.assigned_worker).joinedload(Worker.user)
    ).filter(Ticket.id == ticket_id).first()

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
                detail="Access denied. Field workers can only access assigned tickets."
            )

    return _format_ticket_response(ticket)

@router.patch("/{ticket_id}/assign", response_model=TicketResponse)
async def assign_worker_to_ticket(
    ticket_id: str,
    payload: TicketAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN]))
):
    """Assigns a field worker to a ticket (Admin role required)."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    worker = db.query(Worker).filter(Worker.id == payload.assigned_worker_id).first()
    if not worker:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found.")

    ticket.assigned_worker_id = worker.id
    if ticket.status == TicketStatus.OPEN.value:
        ticket.status = TicketStatus.ASSIGNED.value
    ticket.updated_at = datetime.datetime.now(datetime.timezone.utc)

    db.commit()
    db.refresh(ticket)
    return _format_ticket_response(ticket)

@router.patch("/{ticket_id}/status", response_model=TicketResponse)
async def update_ticket_status(
    ticket_id: str,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Updates ticket status with role validation."""
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    if current_user.role == UserRole.FIELD_WORKER:
        worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
        if not worker_rec or ticket.assigned_worker_id != worker_rec.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Field workers can only update status on assigned tickets."
            )

    ticket.status = payload.status.value
    ticket.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(ticket)

    return _format_ticket_response(ticket)


@router.post("/{ticket_id}/review", response_model=ReviewActionResponse)
async def review_ticket_action(
    ticket_id: str,
    payload: ReviewActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Executes a manual reviewer decision action on a ticket:
    - Actions: APPROVE_CLOSURE (CLOSED), REQUEST_REVERIFICATION (IN_PROGRESS), REOPEN_TICKET (OPEN).
    - Restricted to ADMIN and REVIEWER.
    - Workers CANNOT review or approve their own ticket closures.
    - Automatically records ReviewAction and AuditLog.
    """
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ticket not found.")

    # Enforcement: Worker cannot review ticket even if assigned or promoted
    worker_rec = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if worker_rec and ticket.assigned_worker_id == worker_rec.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conflict of Interest: Field workers cannot review or approve their own assigned ticket closures."
        )

    valid_actions = {"APPROVE_CLOSURE", "REQUEST_REVERIFICATION", "REOPEN_TICKET"}
    if payload.action not in valid_actions:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid review action '{payload.action}'. Allowed: {', '.join(valid_actions)}."
        )

    now_utc = datetime.datetime.now(datetime.timezone.utc)

    # Transition ticket status based on review decision
    if payload.action == "APPROVE_CLOSURE":
        ticket.status = TicketStatus.CLOSED.value
    elif payload.action == "REQUEST_REVERIFICATION":
        ticket.status = TicketStatus.IN_PROGRESS.value
    elif payload.action == "REOPEN_TICKET":
        ticket.status = TicketStatus.OPEN.value

    ticket.updated_at = now_utc

    # Record ReviewAction
    review_rec = ReviewAction(
        ticket_id=ticket.id,
        reviewer_id=current_user.id,
        action=payload.action,
        comments=payload.comments,
        created_at=now_utc
    )
    db.add(review_rec)

    # Record AuditLog
    audit_rec = AuditLog(
        user_id=current_user.id,
        action=f"REVIEW_ACTION_{payload.action}",
        resource=f"TICKET:{ticket.id}",
        details={"comments": payload.comments or "", "reviewer_email": current_user.email},
        timestamp=now_utc
    )
    db.add(audit_rec)

    db.commit()
    db.refresh(review_rec)

    return ReviewActionResponse.model_validate(review_rec)


@router.post("/public", status_code=status.HTTP_201_CREATED)
async def create_citizen_ticket(
    payload: CitizenReportCreate,
    db: Session = Depends(get_db)
):
    """Allows citizens to report a municipal complaint with server-side spatial ward lookup."""
    ward_lookup = get_ward_lookup_service()
    derived_info = ward_lookup.resolve_ward(payload.latitude, payload.longitude)

    # 1. Resolve Ward Object from derived ward number or requested ward_id
    ward_obj = None
    if derived_info.get("ward_number"):
        ward_obj = db.query(Ward).filter(Ward.ward_number == derived_info["ward_number"]).first()

    if not ward_obj and payload.ward_id:
        ward_obj = db.query(Ward).filter(Ward.id == payload.ward_id).first()
        if not ward_obj and payload.ward_id.isdigit():
            ward_obj = db.query(Ward).filter(Ward.ward_number == int(payload.ward_id)).first()

    if not ward_obj:
        ward_obj = db.query(Ward).first()

    if not ward_obj:
        ward_obj = Ward(
            ward_number=derived_info.get("ward_number") or 14,
            name=derived_info.get("ward_name") or "Ward 14 - Malleshwaram",
            zone=derived_info.get("zone") or "North Zone"
        )
        db.add(ward_obj)
        db.commit()
        db.refresh(ward_obj)

    ward_id = ward_obj.id

    rand_suffix = random.randint(10000, 99999)
    ticket_num = f"MK-{rand_suffix}"

    title = f"{payload.complaint_type.replace('_', ' ').title()} Report"
    if payload.description:
        title = payload.description[:50]

    # Auto-assign available field worker assigned to this ward
    assigned_worker = db.query(Worker).filter(Worker.ward_id == ward_id).first()
    if not assigned_worker:
        assigned_worker = db.query(Worker).first()

    assigned_worker_id = assigned_worker.id if assigned_worker else None
    initial_status = TicketStatus.ASSIGNED.value if assigned_worker else TicketStatus.OPEN.value

    now = datetime.datetime.now(datetime.timezone.utc)
    new_ticket = Ticket(
        id=str(uuid.uuid4()),
        ticket_number=ticket_num,
        complaint_type=payload.complaint_type,
        title=title,
        description=payload.description,
        latitude=payload.latitude,
        longitude=payload.longitude,
        accuracy_meters=payload.accuracy_meters,
        location_captured_at=payload.captured_at or now,
        location_source=payload.location_source or "device_gps",
        location_status=payload.location_status or ("GPS_CAPTURED" if payload.latitude and payload.longitude else "GPS_UNAVAILABLE"),
        ward_derived_from=derived_info.get("derived_from", "gps_polygon"),
        ward_id=ward_id,
        assigned_worker_id=assigned_worker_id,
        priority="MEDIUM",
        status=initial_status,
        created_at=now,
        updated_at=now
    )
    db.add(new_ticket)
    db.commit()
    db.refresh(new_ticket)
    if payload.photo_base64:
        import base64
        import hashlib
        import os
        try:
            image_data = base64.b64decode(payload.photo_base64.split(",")[-1])
            sha256_hash = hashlib.sha256(image_data).hexdigest()
            filename = f"citizen_before_{new_ticket.id[:8]}.jpg"
            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "evidence"))
            os.makedirs(uploads_dir, exist_ok=True)
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, "wb") as f:
                f.write(image_data)

            rel_path = f"/uploads/evidence/{filename}"
            evidence = TicketEvidence(
                ticket_id=new_ticket.id,
                evidence_type=EvidenceType.BEFORE.value,
                source_type=SourceType.UPLOAD.value,
                file_path=rel_path,
                file_type="image/jpeg",
                sha256_hash=sha256_hash,
                latitude=payload.latitude or 12.9716,
                longitude=payload.longitude or 77.5946
            )
            db.add(evidence)
            db.commit()
        except Exception as e:
            print(f"Warning saving citizen evidence photo: {e}")

    return _format_ticket_response(new_ticket)


@router.post("/{ticket_id}/start-task", response_model=TicketResponse)
async def start_worker_task(
    ticket_id: str,
    payload: WorkerStartTaskRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.FIELD_WORKER))
):
    """
    Worker task start endpoint.
    Captures live device GPS location and accuracy at the start of a task.
    """
    worker = db.query(Worker).filter(Worker.user_id == current_user.id).first()
    if not worker:
        raise HTTPException(status_code=403, detail="Not authorized as a field worker.")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found.")

    if ticket.assigned_worker_id and ticket.assigned_worker_id != worker.id:
        raise HTTPException(status_code=403, detail="You can only start tasks assigned to you.")

    now = datetime.datetime.now(datetime.timezone.utc)
    ticket.worker_start_latitude = payload.latitude
    ticket.worker_start_longitude = payload.longitude
    ticket.worker_start_accuracy = payload.accuracy_meters
    ticket.worker_start_timestamp = payload.captured_at or now
    ticket.status = TicketStatus.IN_PROGRESS.value
    ticket.assigned_worker_id = worker.id

    db.commit()
    db.refresh(ticket)
    return _format_ticket_response(ticket)


@router.get("/public/track/{ticket_num_or_id}")
async def track_citizen_ticket(
    ticket_num_or_id: str,
    db: Session = Depends(get_db)
):
    """Allows citizens to track a complaint by ticket number (#MK-XXXXX) or UUID."""
    search_str = ticket_num_or_id.strip()
    if search_str.startswith("#"):
        search_str = search_str[1:]

    ticket = db.query(Ticket).options(
        joinedload(Ticket.ward),
        joinedload(Ticket.evidences)
    ).filter(
        (Ticket.ticket_number.ilike(search_str)) |
        (Ticket.ticket_number.ilike(f"%{search_str}%")) |
        (Ticket.id == search_str)
    ).first()

    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with reference '{ticket_num_or_id}' was not found."
        )

    before_url = None
    after_url = None
    res_date = None

    for ev in ticket.evidences:
        if ev.evidence_type == EvidenceType.BEFORE.value and not before_url:
            before_url = ev.file_path
        elif ev.evidence_type in (EvidenceType.AFTER.value, EvidenceType.LIVE_VERIFICATION.value) and not after_url:
            after_url = ev.file_path
            res_date = ev.uploaded_at

    return {
        "ticket_id": ticket.id,
        "ticket_number": ticket.ticket_number,
        "complaint_type": ticket.complaint_type,
        "title": ticket.title,
        "description": ticket.description,
        "status": ticket.status,
        "created_at": ticket.created_at,
        "updated_at": ticket.updated_at,
        "ward_name": ticket.ward.name if ticket.ward else "Central Zone",
        "before_image_url": before_url or "/uploads/evidence/demo_before_a.jpg",
        "resolution_image_url": after_url,
        "resolution_date": res_date or ticket.updated_at
    }


@router.post("/public/{ticket_num_or_id}/confirm")
async def confirm_citizen_resolution(
    ticket_num_or_id: str,
    db: Session = Depends(get_db)
):
    """Citizen confirms that the complaint has been satisfactorily resolved."""
    search_str = ticket_num_or_id.strip().lstrip("#")
    ticket = db.query(Ticket).filter(
        (Ticket.ticket_number.ilike(search_str)) | (Ticket.id == search_str)
    ).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    ticket.status = TicketStatus.CITIZEN_CONFIRMED.value
    ticket.updated_at = datetime.datetime.now(datetime.timezone.utc)
    db.commit()
    db.refresh(ticket)

    return {"status": "success", "ticket_number": ticket.ticket_number, "new_status": ticket.status}


@router.post("/public/{ticket_num_or_id}/dispute")
async def dispute_citizen_resolution(
    ticket_num_or_id: str,
    payload: CitizenDisputeCreate,
    db: Session = Depends(get_db)
):
    """Citizen files a dispute indicating the reported issue remains unresolved."""
    search_str = ticket_num_or_id.strip().lstrip("#")
    ticket = db.query(Ticket).filter(
        (Ticket.ticket_number.ilike(search_str)) | (Ticket.id == search_str)
    ).first()

    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Complaint not found.")

    ticket.status = TicketStatus.CITIZEN_DISPUTE.value
    ticket.updated_at = datetime.datetime.now(datetime.timezone.utc)

    evidence_id = None
    if payload.evidence_base64:
        import base64
        import hashlib
        import os
        try:
            image_data = base64.b64decode(payload.evidence_base64.split(",")[-1])
            sha256_hash = hashlib.sha256(image_data).hexdigest()
            filename = f"dispute_evidence_{ticket.id[:8]}.jpg"
            uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..", "uploads", "evidence"))
            os.makedirs(uploads_dir, exist_ok=True)
            filepath = os.path.join(uploads_dir, filename)
            with open(filepath, "wb") as f:
                f.write(image_data)

            rel_path = f"/uploads/evidence/{filename}"
            evidence = TicketEvidence(
                ticket_id=ticket.id,
                evidence_type=EvidenceType.BEFORE.value,
                source_type=SourceType.UPLOAD.value,
                file_path=rel_path,
                file_type="image/jpeg",
                sha256_hash=sha256_hash
            )
            db.add(evidence)
            db.commit()
            db.refresh(evidence)
            evidence_id = evidence.id
        except Exception as e:
            print(f"Warning saving dispute evidence photo: {e}")

    dispute = CitizenDispute(
        ticket_id=ticket.id,
        citizen_reference=ticket.ticket_number,
        reason=payload.reason,
        evidence_id=evidence_id,
        status="OPEN"
    )
    db.add(dispute)
    db.commit()
    db.refresh(dispute)

    return {
        "status": "success",
        "dispute_id": dispute.id,
        "ticket_number": ticket.ticket_number,
        "new_status": ticket.status
    }




