import os
import shutil
import uuid
import datetime
import pytest
import numpy as np
import cv2

from app.db.session import SessionLocal
from app.models.entities import (
    Ticket, TicketEvidence, Worker, User, TicketStatus,
    VerificationSession, VerificationResult, VerificationSignal, Ward
)
from app.services.integrity_scoring import IntegrityScoringService
from app.services.spatial_temporal import get_temporal_consistency_service
from app.services.freshness_service import get_evidence_freshness_service

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


def create_test_session(db, complaint_type, b_lat, b_lon, b_acc, a_lat, a_lon, a_acc, b_src, a_src, b_hash=None, a_hash=None):
    """Helper to create complete database test fixtures."""
    ward_rec = db.query(Ward).first()
    
    test_user = User(
        email=f"worker_consist_{uuid.uuid4().hex[:6]}@example.com",
        full_name="Consistency Worker",
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
        ticket_number=f"TKT-CS-{uuid.uuid4().hex[:6]}",
        complaint_type=complaint_type,
        title="Pothole Consistency Test",
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

    rel_b_path = copy_to_uploads(b_src, "b_img")
    rel_a_path = copy_to_uploads(a_src, "a_img")

    ev_b = TicketEvidence(
        ticket_id=t.id,
        evidence_type="BEFORE",
        source_type="LIVE_CAMERA",
        file_path=rel_b_path,
        file_type="image/png",
        sha256_hash=b_hash or f"hash_b_{uuid.uuid4().hex}",
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
        sha256_hash=a_hash or f"hash_a_{uuid.uuid4().hex}",
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

    return session, worker_rec, t, ev_b, ev_a


def test_case_a_same_pothole_location_repaired_road_verified():
    """Case A: Same pothole location + repaired road + valid evidence -> VERIFIED / high confidence."""
    db = SessionLocal()
    try:
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        scoring = IntegrityScoringService()
        res = scoring.finalize_verification(db, session.id)
        
        print("Case A Decision:", res.decision, "Score:", res.overall_score)
        assert res.decision == "VERIFIED"
        assert res.overall_score >= 80.0
    finally:
        db.close()


def test_case_b_same_location_pothole_still_present_not_verified():
    """Case B: Same location + pothole still present -> NOT VERIFIED."""
    db = SessionLocal()
    try:
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_POTHOLE_SRC
        )
        scoring = IntegrityScoringService()
        res = scoring.finalize_verification(db, session.id)
        
        print("Case B Decision:", res.decision, "Score:", res.overall_score)
        assert res.decision in ("CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW")
        assert res.decision != "VERIFIED"
    finally:
        db.close()


def test_case_c_different_road_location_not_verified():
    """Case C: Different road / location -> NOT VERIFIED."""
    diff_img_path = os.path.join(UPLOADS_DIR, f"diff_{uuid.uuid4().hex[:6]}.png")
    diff_mat = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(diff_mat, (320, 240), 100, (200, 200, 200), -1)
    cv2.imwrite(diff_img_path, diff_mat)

    db = SessionLocal()
    try:
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, diff_img_path
        )
        scoring = IntegrityScoringService()
        res = scoring.finalize_verification(db, session.id)
        
        print("Case C Decision:", res.decision, "Score:", res.overall_score)
        assert res.decision == "CLOSURE_NOT_VERIFIED"
        assert res.overall_score <= 25.0
    finally:
        if os.path.exists(diff_img_path):
            os.remove(diff_img_path)
        db.close()


def test_case_d_worker_retry_submission_not_replayed():
    """Case D: Same worker legitimately retries evidence on same ticket -> NOT automatically REPLAYED."""
    db = SessionLocal()
    try:
        # Create initial submission
        session1, worker, t, ev_b, ev_a1 = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        
        # Worker retries by creating a 2nd evidence record for the same ticket
        now = datetime.datetime.now(datetime.timezone.utc)
        ev_a2 = TicketEvidence(
            ticket_id=t.id,
            evidence_type="AFTER",
            source_type="LIVE_CAMERA",
            file_path=copy_to_uploads(IMG_FIXED_SRC, "retry_img"),
            file_type="image/png",
            sha256_hash=ev_a1.sha256_hash, # same photo payload retried
            latitude=13.0031,
            longitude=77.5643,
            accuracy_meters=15.0
        )
        db.add(ev_a2)
        db.commit()
        db.refresh(ev_a2)

        session2 = VerificationSession(
            ticket_id=t.id,
            worker_id=worker.id,
            evidence_id=ev_a2.id,
            expires_at=now + datetime.timedelta(hours=2)
        )
        db.add(session2)
        db.commit()
        db.refresh(session2)
        ev_a2.verification_session_id = session2.id
        db.commit()

        fresh_svc = get_evidence_freshness_service()
        res_fresh = fresh_svc.analyze_freshness(db, session2.id, ev_a2)
        
        print("Case D Freshness is_exact_duplicate:", res_fresh.is_exact_duplicate, "Score:", res_fresh.freshness_score)
        assert res_fresh.is_exact_duplicate is False, "Worker retrying on same ticket must NOT be flagged as replay attack"
        assert res_fresh.freshness_score >= 80.0
    finally:
        db.close()


def test_case_e_evidence_reused_from_another_complaint_replay_detected():
    """Case E: Same evidence file reused from another complaint -> REPLAY DETECTED."""
    db = SessionLocal()
    try:
        # Ticket 1 with genuine evidence
        shared_hash = f"shared_proof_{uuid.uuid4().hex}"
        session1, worker1, t1, ev_b1, ev_a1 = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 15.0,
            13.0031, 77.5643, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC,
            a_hash=shared_hash
        )

        # Ticket 2 where evidence with the same hash is re-submitted
        session2, worker2, t2, ev_b2, ev_a2 = create_test_session(
            db, "POTHOLE",
            13.0080, 77.5700, 15.0,
            13.0080, 77.5700, 15.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC,
            a_hash=shared_hash # replaying evidence from Ticket 1
        )

        fresh_svc = get_evidence_freshness_service()
        res_fresh = fresh_svc.analyze_freshness(db, session2.id, ev_a2)
        
        print("Case E Freshness is_exact_duplicate:", res_fresh.is_exact_duplicate, "Explanation:", res_fresh.explanation)
        assert res_fresh.is_exact_duplicate is True, "Replay of evidence from a different ticket MUST be flagged as exact duplicate"
        assert res_fresh.freshness_score == 0.0
        assert "REPLAY ATTACK" in res_fresh.explanation
    finally:
        db.close()


def test_case_f_distance_89m_tolerance_272m_gps_pass():
    """Case F: GPS distance 89m with tolerance 272m -> MUST NOT show GPS FAIL."""
    db = SessionLocal()
    try:
        # Distance ~89m (0.0008 deg latitude approx 88.9m)
        # Citizen accuracy ±200m, Worker accuracy ±72m -> Total tolerance 272m
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 200.0,
            13.0039, 77.5643, 72.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        spatial_svc = get_temporal_consistency_service()
        res_sp = spatial_svc.analyze(db, session.id)
        
        print("Case F GPS status:", res_sp.location_status, "Dist:", res_sp.distance_meters)
        assert res_sp.location_status in ("GPS_PASS", "GPS_BORDERLINE")
        assert res_sp.location_status != "GPS_MISMATCH"
        assert res_sp.spatial_score >= 50.0
    finally:
        db.close()


def test_case_g_poor_gps_accuracy_plausible_location_not_automatic_fail():
    """Case G: Poor GPS accuracy but plausible location -> BORDERLINE / HUMAN_REVIEW, not automatic fail."""
    db = SessionLocal()
    try:
        # Distance ~150m with citizen accuracy 180m and worker accuracy 120m (tolerance 300m)
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 180.0,
            13.00445, 77.5643, 120.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        spatial_svc = get_temporal_consistency_service()
        res_sp = spatial_svc.analyze(db, session.id)
        
        print("Case G GPS status:", res_sp.location_status, "Dist:", res_sp.distance_meters)
        assert res_sp.location_status in ("GPS_PASS", "GPS_BORDERLINE")
        assert res_sp.location_status != "GPS_MISMATCH"
    finally:
        db.close()


def test_target_scenario_a_167m_dist_215m_tolerance_gps_pass():
    """TEST A: 167m distance, 215m tolerance -> GPS MUST = PASS."""
    db = SessionLocal()
    try:
        # Latitude diff 0.0015 deg ~ 166.8m distance
        # Citizen accuracy 115m, Worker accuracy 100m -> Tolerance = 215m
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 115.0,
            13.0046, 77.5643, 100.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        spatial_svc = get_temporal_consistency_service()
        res_sp = spatial_svc.analyze(db, session.id)
        
        print("TEST A GPS Status:", res_sp.location_status, "Dist:", res_sp.distance_meters)
        assert res_sp.location_status == "GPS_PASS", f"Expected GPS_PASS for 167m within 215m tolerance, got {res_sp.location_status}"
        assert res_sp.spatial_score == 100.0
    finally:
        db.close()


def test_target_scenario_b_250m_dist_215m_tolerance_borderline():
    """TEST B: 250m distance, 215m tolerance -> GPS BORDERLINE (not PASS)."""
    db = SessionLocal()
    try:
        # Latitude diff 0.00225 deg ~ 250.2m distance
        # Citizen accuracy 115m, Worker accuracy 100m -> Tolerance = 215m
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 115.0,
            13.00535, 77.5643, 100.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        spatial_svc = get_temporal_consistency_service()
        res_sp = spatial_svc.analyze(db, session.id)
        
        print("TEST B GPS Status:", res_sp.location_status, "Dist:", res_sp.distance_meters)
        assert res_sp.location_status in ("GPS_BORDERLINE", "GPS_MISMATCH")
        assert res_sp.location_status != "GPS_PASS"
    finally:
        db.close()


def test_target_scenario_e_live_pothole_repaired_167m_verified():
    """TEST E: Live pothole test with 167m distance, 215m tolerance -> VERIFIED / RESOLVED."""
    db = SessionLocal()
    try:
        session, worker, t, ev_b, ev_a = create_test_session(
            db, "POTHOLE",
            13.0031, 77.5643, 115.0,
            13.0046, 77.5643, 100.0,
            IMG_POTHOLE_SRC, IMG_FIXED_SRC
        )
        scoring = IntegrityScoringService()
        res = scoring.finalize_verification(db, session.id)
        
        print("TEST E Final Decision:", res.decision, "Score:", res.overall_score, "Details:", res.detailed_result)
        assert res.decision == "VERIFIED", f"Expected VERIFIED, got {res.decision}"
        assert res.detailed_result["location"]["status"] == "GPS_PASS"
        assert res.detailed_result["issue"]["status"] == "RESOLVED"
        assert res.overall_score >= 80.0
    finally:
        db.close()

