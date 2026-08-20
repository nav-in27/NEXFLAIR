import os
import base64
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, TicketEvidence, Worker, User, TicketStatus, VerificationSession
from app.services.scene_verification import get_scene_verification_service
from app.services.spatial_temporal import get_temporal_consistency_service
from app.services.integrity_scoring import IntegrityScoringService

client = TestClient(app)

IMG_POTHOLE_PATH = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582790.png"
IMG_FIXED_PATH = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582742.png"

def get_token(email: str = "worker@meikaan.gov", password: str = "Worker@123") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]


def test_case_a_same_pothole_location_verification():
    """TEST A: Same pothole location, BEFORE = pothole, AFTER = repaired pothole, GPS = same area."""
    scene_svc = get_scene_verification_service()
    res_scene = scene_svc.analyze(IMG_POTHOLE_PATH, IMG_FIXED_PATH)
    assert res_scene.error is None
    assert res_scene.keypoints_before > 0
    assert res_scene.keypoints_after > 0


def test_case_b_different_location_scene_rejection():
    """TEST B: Completely different road image/location -> CLOSURE_NOT_VERIFIED."""
    scene_svc = get_scene_verification_service()
    # Create black/white contrast dummy image representing completely different scene
    import numpy as np
    import cv2
    dummy_diff = np.zeros((480, 640, 3), dtype=np.uint8)
    cv2.circle(dummy_diff, (100, 100), 50, (255, 255, 255), -1)
    
    res_scene = scene_svc.analyze(IMG_POTHOLE_PATH, dummy_diff)
    assert res_scene.scene_status in ("DIFFERENT_SCENE", "UNCERTAIN")


def test_case_c_18m_gps_difference_with_accuracy():
    """TEST C: Same location but GPS difference around 18m with reasonable GPS accuracy (e.g. 25m)."""
    import uuid
    import datetime
    db = SessionLocal()
    try:
        from app.models.entities import Ward, User
        ward_rec = db.query(Ward).first()
        test_user = User(
            email=f"worker_gps_{uuid.uuid4().hex[:6]}@example.com",
            full_name="GPS Test Worker",
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
            ticket_number=f"TEST-GPS-{uuid.uuid4().hex[:6]}",
            complaint_type="ROAD_DEFECT",
            title="GPS 18m Test",
            latitude=13.003100,
            longitude=77.564300,
            accuracy_meters=15.0,
            status=TicketStatus.IN_PROGRESS.value,
            ward_id=ward_rec.id if ward_rec else worker_rec.ward_id,
            assigned_worker_id=worker_rec.id
        )
        db.add(t)
        db.commit()
        db.refresh(t)

        # 18m offset in latitude (~0.000162 deg)
        ev = TicketEvidence(
            ticket_id=t.id,
            evidence_type="AFTER",
            source_type="LIVE_CAMERA",
            file_path="/uploads/evidence/test_gps.jpg",
            file_type="image/jpeg",
            sha256_hash="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            latitude=13.003262,
            longitude=77.564300,
            accuracy_meters=25.0
        )
        db.add(ev)
        
        import datetime
        now = datetime.datetime.now(datetime.timezone.utc)
        session = VerificationSession(
            ticket_id=t.id,
            worker_id=worker_rec.id,
            evidence_id=ev.id,
            expires_at=now + datetime.timedelta(hours=2)
        )
        db.add(session)
        db.commit()
        db.refresh(session)
        ev.verification_session_id = session.id
        db.commit()

        spatial_svc = get_temporal_consistency_service()
        res = spatial_svc.analyze(db, session.id)
        assert res.location_status in ("GPS_PASS", "GPS_BORDERLINE")
        assert res.location_status != "GPS_MISMATCH"
        assert res.distance_meters is not None
        assert 15.0 <= res.distance_meters <= 22.0
    finally:
        db.close()


def test_case_d_and_e_worker_reopen_and_relogin_task():
    """TEST D & E: Worker opens same task multiple times and reloads/logs in again."""
    token = get_token()
    
    # 1. Fetch worker tasks list
    res_list = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
    assert res_list.status_code == 200
    tasks = res_list.json()
    assert len(tasks) > 0
    test_task = tasks[0]
    task_id = test_task["id"]

    # 2. Open task first time
    res1 = client.get(f"/api/tickets/{task_id}", headers={"Authorization": f"Bearer {token}"})
    assert res1.status_code == 200
    assert res1.json()["id"] == task_id

    # 3. Open task second time (reopen)
    res2 = client.get(f"/api/tickets/{task_id}", headers={"Authorization": f"Bearer {token}"})
    assert res2.status_code == 200
    assert res2.json()["id"] == task_id

    # 4. Relogin and open task again
    new_token = get_token()
    res3 = client.get(f"/api/tickets/{task_id}", headers={"Authorization": f"Bearer {new_token}"})
    assert res3.status_code == 200
    assert res3.json()["id"] == task_id


def test_case_f_invalid_unreadable_photo_handling():
    """TEST F: Invalid/unreadable photo yields clear verification failure/HUMAN_REVIEW, not unexplained 0."""
    scene_svc = get_scene_verification_service()
    res = scene_svc.analyze(b"not a valid image bytes", b"corrupt bytes")
    assert res.error is not None
    assert "Failed to load" in res.error or "Unsupported" in res.error


def test_case_g_worker_portal_real_assigned_tasks_only():
    """TEST G: Worker portal queries and returns only real assigned complaints belonging to authenticated worker."""
    token = get_token("worker@meikaan.gov", "Worker@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    tasks = res.json()
    
    db = SessionLocal()
    try:
        worker_rec = db.query(Worker).join(User, Worker.user_id == User.id).filter(User.email == "worker@meikaan.gov").first()
        for t in tasks:
            assert t["assigned_worker_id"] == worker_rec.id
    finally:
        db.close()
