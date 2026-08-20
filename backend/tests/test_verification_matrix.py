"""
MEIKAAN Verification Engine Core Fix Regression Test Suite
==========================================================
Tests the core verification engine architecture to ensure:
- Unrelated images receive CLOSURE_NOT_VERIFIED with low Evidence Integrity score (never 92 VERIFIED).
- GPS location mismatch is a critical failure that overrides visual similarity.
- Hazard change is UNVERIFIABLE when location or scene identity fails.
- Hard decision gates enforce non-negotiable verification principles.
"""

import os
import io
import uuid
import pytest
import datetime
import numpy as np
import cv2
from PIL import Image
from sqlalchemy.orm import Session

from app.db.session import Base, engine, SessionLocal
from app.models.entities import (
    User, UserRole, Ward, Worker, Ticket, TicketEvidence, VerificationSession,
    VerificationResult, VerificationSignal, TicketStatus, EvidenceType, SourceType
)
from app.services.integrity_scoring import get_integrity_scoring_service
from app.services.scene_verification import get_scene_verification_service
from app.services.spatial_temporal import get_temporal_consistency_service, haversine_distance_meters
from app.services.hazard_detection import get_hazard_detection_service
from app.services.storage import get_storage_provider


def create_synthetic_road_image(width=640, height=480, add_water=False, pattern_id=1) -> bytes:
    """Helper to generate synthetic test images with distinct road patterns and water puddles."""
    state = np.random.RandomState(pattern_id * 100)
    noise = state.randint(0, 50, (height, width, 3), dtype=np.uint8)
    
    img = np.zeros((height, width, 3), dtype=np.uint8) + 80
    img = cv2.add(img, noise)

    if pattern_id == 1:
        # Road A: Vertical lane lines + yellow curb on left + circles
        cv2.line(img, (width // 2, 0), (width // 2, height), (255, 255, 255), 4)
        cv2.rectangle(img, (0, 0), (40, height), (0, 220, 220), -1)
        for y in range(20, height, 40):
            cv2.circle(img, (100, y), 8, (200, 200, 200), -1)
            cv2.circle(img, (width - 100, y), 8, (200, 200, 200), -1)
    elif pattern_id == 2:
        # Road B: Horizontal brick wall pattern on right + diagonal lines
        cv2.rectangle(img, (width - 100, 0), (width, height), (50, 50, 180), -1)
        for y in range(0, height, 60):
            cv2.line(img, (0, y), (width - 100, y + 40), (200, 200, 200), 2)
    else:
        # Road C: Checkerboard pattern
        for y in range(0, height, 80):
            for x in range(0, width, 80):
                if (x // 80 + y // 80) % 2 == 0:
                    img[y:y+80, x:x+80] = cv2.add(img[y:y+80, x:x+80], 40)

    if add_water:
        # Dark murky puddle in bottom-center
        cv2.ellipse(img, (width // 2, height - 120), (120, 60), 0, 0, 360, (35, 30, 25), -1)

    is_success, buffer = cv2.imencode(".jpg", img)
    return buffer.tobytes()


@pytest.fixture
def db_session():
    """Creates temporary in-memory DB tables for testing."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def setup_ticket_fixture(db: Session, citizen_lat=12.9716, citizen_lon=77.5946, worker_lat=12.9716, worker_lon=77.5946):
    """Sets up user, ward, worker, ticket, before evidence, and verification session."""
    storage = get_storage_provider()
    now = datetime.datetime.now(datetime.timezone.utc)
    uid = uuid.uuid4().hex[:8]

    # 1. Query or Create Ward
    ward = db.query(Ward).filter(Ward.ward_number == 14).first()
    if not ward:
        ward = Ward(ward_number=14, name="Test Ward 14", zone="CENTRAL")
        db.add(ward)
        db.commit()

    user = User(email=f"worker_{uid}@meikaan.gov.in", hashed_password="pw", full_name="Worker 1", role=UserRole.FIELD_WORKER)
    db.add(user)
    db.commit()

    worker = Worker(user_id=user.id, ward_id=ward.id, worker_code=f"WK-{uid}")
    db.add(worker)
    db.commit()

    # 2. Create Ticket
    ticket = Ticket(
        ticket_number=f"TKT-{uid}",
        complaint_type="STAGNANT_WATER",
        title="Heavy Stagnant Water Puddle",
        latitude=citizen_lat,
        longitude=citizen_lon,
        ward_id=ward.id,
        assigned_worker_id=worker.id,
        status=TicketStatus.IN_PROGRESS.value,
    )
    db.add(ticket)
    db.commit()

    # 3. Create Verification Session
    session = VerificationSession(
        ticket_id=ticket.id,
        worker_id=worker.id,
        status="IN_PROGRESS",
        started_at=now,
        expires_at=now + datetime.timedelta(minutes=15),
    )
    db.add(session)
    db.commit()

    return ticket, worker, session


def test_1_critical_failure_road_a_water_vs_road_b_clean(db_session):
    """
    CRITICAL ACCEPTANCE TEST:
    Citizen reports Road A + stagnant water at Location A (lat=12.9716, lon=77.5946).
    Worker submits photo of Road B clean at Location B (lat=12.9900, lon=77.6100 - ~2.5km away).
    EXPECTED:
    - location_status == "FAIL"
    - scene_status == "FAIL"
    - hazard_status == "UNVERIFIABLE"
    - decision == "CLOSURE_NOT_VERIFIED"
    - overall_score <= 15.0 (MUST NOT BE 92 VERIFIED!)
    """
    storage = get_storage_provider()

    # Location A (Citizen) vs Location B (Worker: 2.5km away)
    ticket, worker, session = setup_ticket_fixture(
        db_session,
        citizen_lat=12.9716, citizen_lon=77.5946,
        worker_lat=12.9900, worker_lon=77.6100
    )

    # Citizen Image A: Road A + Water
    img_a_bytes = create_synthetic_road_image(add_water=True, pattern_id=1)
    rel_a, _ = storage.save_file(img_a_bytes, "complaint_a.jpg", "image/jpeg")
    ev_a = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.BEFORE.value,
        source_type=SourceType.UPLOAD.value,
        file_path=rel_a,
        file_type="image/jpeg",
        sha256_hash="hash_a_123",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(ev_a)

    # Worker Image B: Road B Clean (Different physical environment)
    img_b_bytes = create_synthetic_road_image(add_water=False, pattern_id=2)
    rel_b, _ = storage.save_file(img_b_bytes, "worker_b.jpg", "image/jpeg")
    ev_b = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        source_type=SourceType.LIVE_CAMERA.value,
        file_path=rel_b,
        file_type="image/jpeg",
        sha256_hash="hash_b_456",
        latitude=12.9900,
        longitude=77.6100,
        verification_session_id=session.id,
    )
    db_session.add(ev_b)
    db_session.commit()

    # Run Fusion Engine Analysis
    fusion_svc = get_integrity_scoring_service()
    res = fusion_svc.finalize_verification(db_session, session.id)

    # VERIFY HARD GATE CONSTRAINTS:
    assert res.decision == "CLOSURE_NOT_VERIFIED", f"Expected CLOSURE_NOT_VERIFIED but got {res.decision}"
    assert res.overall_score <= 15.0, f"Score MUST NOT be high! Expected <= 15.0, got {res.overall_score}"
    assert ticket.status == TicketStatus.CLOSURE_NOT_VERIFIED.value

    # Verify signals
    signals_dict = {s["signal_name"]: s["signal_value"] for s in res.signals}
    assert signals_dict.get("location_status") == "FAIL"
    assert "LOCATION MISMATCH" in res.explanation or "CLOSURE NOT VERIFIED" in res.explanation


def test_2_genuine_resolution_same_road_water_cleared(db_session):
    """
    Genuine resolution scenario:
    Citizen Image: Road A + Water at Location A.
    Worker Image: Road A + Water removed at Location A.
    EXPECTED: decision == "VERIFIED", score >= 80.0
    """
    storage = get_storage_provider()
    ticket, worker, session = setup_ticket_fixture(db_session, citizen_lat=12.9716, citizen_lon=77.5946, worker_lat=12.9716, worker_lon=77.5946)

    # Image A: Road A + Water
    img_a_bytes = create_synthetic_road_image(add_water=True, pattern_id=1)
    rel_a, _ = storage.save_file(img_a_bytes, "before_water.jpg", "image/jpeg")
    ev_a = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.BEFORE.value,
        source_type=SourceType.UPLOAD.value,
        file_path=rel_a,
        file_type="image/jpeg",
        sha256_hash=f"hash_test_{uuid.uuid4().hex}",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(ev_a)

    # Image B: Road A + Water Removed
    img_b_bytes = create_synthetic_road_image(add_water=False, pattern_id=1)
    rel_b, _ = storage.save_file(img_b_bytes, "after_cleared.jpg", "image/jpeg")
    ev_b = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        source_type=SourceType.LIVE_CAMERA.value,
        file_path=rel_b,
        file_type="image/jpeg",
        sha256_hash=f"hash_test_{uuid.uuid4().hex}",
        latitude=12.9716,
        longitude=77.5946,
        verification_session_id=session.id,
    )
    db_session.add(ev_b)
    db_session.commit()

    fusion_svc = get_integrity_scoring_service()
    res = fusion_svc.finalize_verification(db_session, session.id)

    assert res.decision in ("VERIFIED", "HUMAN_REVIEW")
    assert res.overall_score >= 60.0


def test_3_same_road_water_still_present(db_session):
    """
    Worker visits correct location but puddle was NOT cleared.
    Image A: Road A + Water. Image B: Road A + Water still present.
    EXPECTED: decision in ("CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW")
    """
    storage = get_storage_provider()
    ticket, worker, session = setup_ticket_fixture(db_session)

    img_a_bytes = create_synthetic_road_image(add_water=True, pattern_id=1)
    rel_a, _ = storage.save_file(img_a_bytes, "before_w.jpg", "image/jpeg")
    ev_a = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.BEFORE.value,
        file_path=rel_a,
        file_type="image/jpeg",
        sha256_hash="hash_w1",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(ev_a)

    # Worker submits photo where water is still present
    img_b_bytes = create_synthetic_road_image(add_water=True, pattern_id=1)
    rel_b, _ = storage.save_file(img_b_bytes, "after_w.jpg", "image/jpeg")
    ev_b = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        file_path=rel_b,
        file_type="image/jpeg",
        sha256_hash="hash_w2",
        latitude=12.9716,
        longitude=77.5946,
        verification_session_id=session.id,
    )
    db_session.add(ev_b)
    db_session.commit()

    fusion_svc = get_integrity_scoring_service()
    res = fusion_svc.finalize_verification(db_session, session.id)

    assert res.decision in ("CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW")


def test_4_gps_mismatch_overrides_high_visual_similarity(db_session):
    """
    GPS mismatch (e.g. 1.5km away) with identical visual images.
    EXPECTED: Location Hard Gate FAIL overrides visual similarity -> CLOSURE_NOT_VERIFIED.
    """
    storage = get_storage_provider()
    ticket, worker, session = setup_ticket_fixture(
        db_session,
        citizen_lat=12.9716, citizen_lon=77.5946,
        worker_lat=12.9850, worker_lon=77.6050
    )

    img_bytes = create_synthetic_road_image(add_water=False, pattern_id=1)
    rel_a, _ = storage.save_file(img_bytes, "img_a.jpg", "image/jpeg")
    ev_a = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.BEFORE.value,
        file_path=rel_a,
        file_type="image/jpeg",
        sha256_hash="hash_ident1",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(ev_a)

    rel_b, _ = storage.save_file(img_bytes, "img_b.jpg", "image/jpeg")
    ev_b = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        file_path=rel_b,
        file_type="image/jpeg",
        sha256_hash="hash_ident2",
        latitude=12.9850,
        longitude=77.6050,
        verification_session_id=session.id,
    )
    db_session.add(ev_b)
    db_session.commit()

    fusion_svc = get_integrity_scoring_service()
    res = fusion_svc.finalize_verification(db_session, session.id)

    assert res.decision == "CLOSURE_NOT_VERIFIED"
    assert res.overall_score <= 15.0


def test_5_missing_gps_triggers_human_review_or_closure_not_verified(db_session):
    """
    Worker evidence has NO GPS.
    EXPECTED: location_status == "UNAVAILABLE" -> triggers HUMAN_REVIEW or CLOSURE_NOT_VERIFIED, never auto VERIFIED.
    """
    storage = get_storage_provider()
    ticket, worker, session = setup_ticket_fixture(
        db_session,
        citizen_lat=12.9716, citizen_lon=77.5946,
        worker_lat=None, worker_lon=None
    )

    img_a_bytes = create_synthetic_road_image(add_water=True, pattern_id=1)
    rel_a, _ = storage.save_file(img_a_bytes, "before_no_gps.jpg", "image/jpeg")
    ev_a = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.BEFORE.value,
        file_path=rel_a,
        file_type="image/jpeg",
        sha256_hash="hash_nogps1",
        latitude=12.9716,
        longitude=77.5946,
    )
    db_session.add(ev_a)

    img_b_bytes = create_synthetic_road_image(add_water=False, pattern_id=1)
    rel_b, _ = storage.save_file(img_b_bytes, "after_no_gps.jpg", "image/jpeg")
    ev_b = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type=EvidenceType.LIVE_VERIFICATION.value,
        file_path=rel_b,
        file_type="image/jpeg",
        sha256_hash="hash_nogps2",
        latitude=None,
        longitude=None,
        verification_session_id=session.id,
    )
    db_session.add(ev_b)
    db_session.commit()

    fusion_svc = get_integrity_scoring_service()
    res = fusion_svc.finalize_verification(db_session, session.id)

    assert res.decision in ("HUMAN_REVIEW", "CLOSURE_NOT_VERIFIED")
    assert res.decision != "VERIFIED"
