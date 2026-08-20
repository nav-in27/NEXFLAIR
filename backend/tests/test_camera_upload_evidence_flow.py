import pytest
import uuid
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, TicketEvidence, User, Worker, Ward, VerificationSession, EvidenceType, SourceType, TicketStatus
from app.core.security import create_access_token

client = TestClient(app)

def get_token(email: str = "worker@meikaan.gov", password: str = "Worker@123") -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]

def test_citizen_camera_capture_report_flow():
    """Test 1 & 2: Citizen can report issue with Live Camera vs Uploaded photo."""
    # 1. Citizen reports using LIVE CAMERA capture metadata
    resp_cam = client.post("/api/tickets/public", json={
        "complaint_type": "ROAD_DEFECT",
        "description": "Pothole captured live via mobile camera.",
        "latitude": 13.0031,
        "longitude": 77.5643,
        "accuracy_meters": 12.0,
        "location_source": "device_gps",
        "location_status": "GPS_CAPTURED",
        "photo_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
    })
    assert resp_cam.status_code == 201
    ticket_cam = resp_cam.json()
    assert ticket_cam["ticket_number"].startswith("MK-")
    assert ticket_cam["status"] in ["ASSIGNED", "OPEN"]

    # Verify database record
    db = SessionLocal()
    try:
        ev = db.query(TicketEvidence).filter(TicketEvidence.ticket_id == ticket_cam["id"]).first()
        assert ev is not None
        assert ev.evidence_type == EvidenceType.BEFORE.value
        assert ev.file_path.startswith("/uploads/evidence/")
        assert ev.latitude == 13.0031
        assert ev.longitude == 77.5643
    finally:
        db.close()

def test_worker_camera_and_upload_evidence_flow():
    """Test 3 & 4: Worker submits AFTER evidence via Camera vs File Upload."""
    db = SessionLocal()
    try:
        worker_user = db.query(User).filter(User.email == "worker@meikaan.gov").first()
        worker_rec = db.query(Worker).filter(Worker.user_id == worker_user.id).first()
        ward_rec = db.query(Ward).first()

        ticket = Ticket(
            ticket_number=f"TEST-CAM-{uuid.uuid4().hex[:6]}",
            complaint_type="ROAD_DEFECT",
            title="Pothole Resolution Camera Test",
            latitude=13.0031,
            longitude=77.5643,
            accuracy_meters=15.0,
            status=TicketStatus.IN_PROGRESS.value,
            ward_id=ward_rec.id if ward_rec else worker_rec.ward_id,
            assigned_worker_id=worker_rec.id
        )
        db.add(ticket)
        db.commit()
        db.refresh(ticket)
        
        token = get_token(email="worker@meikaan.gov", password="Worker@123")

        # 1. Start Verification Session
        resp_start = client.post("/api/v1/verification/start", json={"ticket_id": ticket.id}, headers={"Authorization": f"Bearer {token}"})
        assert resp_start.status_code == 201
        session_data = resp_start.json()
        session_id = session_data["id"]

        # 2. Worker uploads AFTER image with LIVE_CAMERA source
        dummy_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xdb\x00C\x00\x08\x06\x06\x07\x06\x05\x08\x07\x07\x07\t\t\x08\n\x0c\x14\r\x0c\x0b\x0b\x0c\x19\x12\x13\x0f\x14\x1d\x1a\x1f\x1e\x1d\x1a\x1c\x1c $.' \",#\x1c\x1c(7),01444\x1f'9=82<.342\xff\xc0\x00\x0b\x08\x00\x01\x00\x01\x01\x01\x11\x00\xff\xc4\x00\x1f\x00\x00\x01\x05\x01\x01\x01\x01\x01\x01\x00\x00\x00\x00\x00\x00\x00\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\xff\xda\x00\x08\x01\x01\x00\x00?\x00\xbf\x00\xff\xd9"
        
        files = {"file": ("camera_resolution.jpg", dummy_jpeg, "image/jpeg")}
        data = {
            "source_type": "LIVE_CAMERA",
            "latitude": "13.003150",
            "longitude": "77.564300",
            "accuracy_meters": "18.0",
            "location_source": "device_gps"
        }
        resp_sub = client.post(f"/api/v1/verification/{session_id}/submit", files=files, data=data, headers={"Authorization": f"Bearer {token}"})
        assert resp_sub.status_code == 200
        
        # Verify persisted evidence record
        ev_after = db.query(TicketEvidence).filter(
            TicketEvidence.ticket_id == ticket.id,
            TicketEvidence.evidence_type == EvidenceType.LIVE_VERIFICATION.value
        ).first()
        assert ev_after is not None
        assert ev_after.source_type == "LIVE_CAMERA"
        assert ev_after.latitude == 13.003150
        assert ev_after.accuracy_meters == 18.0
    finally:
        db.close()
