import os
import shutil
import uuid
import datetime
import pytest
import numpy as np
import cv2
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, TicketEvidence, Worker, User, TicketStatus, VerificationSession, VerificationResult, VerificationSignal
from app.services.scene_verification import get_scene_verification_service
from app.services.hazard_detection import get_hazard_detection_service
from app.services.spatial_temporal import get_temporal_consistency_service
from app.services.integrity_scoring import IntegrityScoringService

client = TestClient(app)

IMG_POTHOLE_SRC = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582790.png"
IMG_FIXED_SRC = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582742.png"

UPLOADS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "evidence"))
os.makedirs(UPLOADS_DIR, exist_ok=True)


def copy_to_uploads(src_path: str, filename_prefix: str) -> str:
    """Copies source image into backend/uploads/evidence/ and returns relative URL path."""
    dest_name = f"{filename_prefix}_{uuid.uuid4().hex[:8]}.png"
    dest_path = os.path.join(UPLOADS_DIR, dest_name)
    shutil.copy(src_path, dest_path)
    return f"/uploads/evidence/{dest_name}"


def create_test_session(db, complaint_type, b_lat, b_lon, b_acc, a_lat, a_lon, a_acc, b_src, a_src):
    """Helper to create complete database test fixtures with files in upload directory."""
    from app.models.entities import Ward
    ward_rec = db.query(Ward).first()
    
    test_user = User(
        email=f"worker_fix_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Fix Test Worker",
        role="FIELD_WORKER",
        hashed_password="mock",
        is_active=True
    )
    db.add(test_user)
    db.commit()
    
    worker_rec = Worker(
        user_id=test_user.id,
        ward_id=ward_rec.id if ward_rec else None,
        worker_code=f"WK-{uuid.uuid4().hex[:6]}",
        status="ACTIVE"
    )
    db.add(worker_rec)
    db.commit()

    t = Ticket(
        ticket_number=f"TEST-TKT-{uuid.uuid4().hex[:6]}",
        complaint_type=complaint_type,
        title="Pothole Test Case",
        latitude=b_lat,
        longitude=b_lon,
        accuracy_meters=b_acc,
        status=TicketStatus.IN_PROGRESS.value,
        ward_id=ward_rec.id if ward_rec else None,
        assigned_worker_id=worker_rec.id
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    rel_b_path = copy_to_uploads(b_src, "pothole_b")
    rel_a_path = copy_to_uploads(a_src, "pothole_a")

    ev_b = TicketEvidence(
        ticket_id=t.id,
        evidence_type="BEFORE",
        source_type="LIVE_CAMERA",
        file_path=rel_b_path,
        file_type="image/png",
        sha256_hash=f"hash_b_{uuid.uuid4().hex}",
        latitude=b_lat,
        longitude=b_lon,
        accuracy_meters=b_acc
    )
    db.add(ev_b)

    ev_a = TicketEvidence(
        ticket_id=t.id,
        evidence_type="AFTER",
        source_type="LIVE_CAMERA",
        file_path=rel_a_path,
        file_type="image/png",
        sha256_hash=f"hash_a_{uuid.uuid4().hex}",
        latitude=a_lat,
        longitude=a_lon,
        accuracy_meters=a_acc
    )
    db.add(ev_a)
    db.commit()
    db.refresh(ev_a)

    now = datetime.datetime.now(datetime.timezone.utc)
    session = VerificationSession(
        ticket_id=t.id,
        worker_id=worker_rec.id,
        evidence_id=ev_a.id,
        expires_at=now + datetime.timedelta(hours=2)
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    ev_a.verification_session_id = session.id
    db.commit()

    return session


def test_1_pothole_before_repaired_road_after_same_scene_valid_gps():
    """TEST 1: Pothole BEFORE + repaired road AFTER + same scene + valid GPS -> VERIFIED / high score."""
    db = SessionLocal()
    try:
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        scoring = IntegrityScoringService()
        result = scoring.finalize_verification(db, session.id)
        
        print("TEST 1 result:", result.decision, result.overall_score)
        assert result.decision == "VERIFIED"
        assert result.overall_score >= 80.0
    finally:
        db.close()


def test_2_pothole_before_same_pothole_after():
    """TEST 2: Pothole BEFORE + same pothole AFTER (not repaired) -> CLOSURE_NOT_VERIFIED."""
    db = SessionLocal()
    try:
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_POTHOLE_SRC
        )
        scoring = IntegrityScoringService()
        result = scoring.finalize_verification(db, session.id)
        
        print("TEST 2 result:", result.decision, result.overall_score)
        assert result.decision in ("CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW")
        assert result.decision != "VERIFIED"
    finally:
        db.close()


def test_3_pothole_before_completely_different_road_after():
    """TEST 3: Pothole BEFORE + completely different road AFTER -> CLOSURE_NOT_VERIFIED."""
    diff_img_path = os.path.join(UPLOADS_DIR, f"temp_diff_{uuid.uuid4().hex[:6]}.png")
    diff_mat = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(diff_mat, (320, 240), 100, (200, 200, 200), -1)
    cv2.imwrite(diff_img_path, diff_mat)

    db = SessionLocal()
    try:
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, diff_img_path
        )
        scoring = IntegrityScoringService()
        result = scoring.finalize_verification(db, session.id)
        
        print("TEST 3 result:", result.decision, result.overall_score)
        assert result.decision == "CLOSURE_NOT_VERIFIED"
    finally:
        if os.path.exists(diff_img_path):
            os.remove(diff_img_path)
        db.close()


def test_4_pothole_before_repaired_after_different_location():
    """TEST 4: Pothole BEFORE + repaired-looking AFTER + clearly different location (e.g. 500m) -> CLOSURE_NOT_VERIFIED."""
    db = SessionLocal()
    try:
        # Distance ~500m (lat offset 0.0045 deg)
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0076, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        scoring = IntegrityScoringService()
        result = scoring.finalize_verification(db, session.id)
        
        print("TEST 4 result:", result.decision, result.overall_score)
        assert result.decision == "CLOSURE_NOT_VERIFIED"
    finally:
        db.close()


def test_5_same_location_poor_gps_accuracy():
    """TEST 5: Same location but poor GPS accuracy (e.g. 150m accuracy) -> GPS BORDERLINE/PASS, NOT automatic fail."""
    db = SessionLocal()
    try:
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 150.0,
            13.0033, 77.5643, 150.0, # ~22m away with 150m accuracy
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        spatial_svc = get_temporal_consistency_service()
        res_sp = spatial_svc.analyze(db, session.id)
        
        print("TEST 5 GPS status:", res_sp.location_status, "dist:", res_sp.distance_meters)
        assert res_sp.location_status in ("GPS_PASS", "GPS_BORDERLINE", "GPS_UNAVAILABLE")
        assert res_sp.location_status != "GPS_MISMATCH"
    finally:
        db.close()


def test_6_gps_result_consistency():
    """TEST 6: GPS result shown as PASS must not simultaneously report GPS FAIL in signals or status."""
    db = SessionLocal()
    try:
        session = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        scoring = IntegrityScoringService()
        result = scoring.finalize_verification(db, session.id)
        
        vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
        assert vr is not None
        
        sig = db.query(VerificationSignal).filter(
            VerificationSignal.result_id == vr.id,
            VerificationSignal.signal_name == "location_status"
        ).first()
        
        print("TEST 6 location signal:", sig.signal_value if sig else None)
        assert sig is not None
        assert sig.signal_value == "GPS_PASS"
        assert sig.signal_value != "FAIL"
        assert sig.signal_value != "GPS_MISMATCH"
    finally:
        db.close()
