import io
import datetime
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def create_dummy_image_bytes(format_name: str = "JPEG", width: int = 120, height: int = 120) -> bytes:
    img = Image.new("RGB", (width, height), color=(0, 200, 100))
    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()

def get_assigned_ticket(worker_token: str):
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    assert res.status_code == 200
    tickets = res.json()
    assert len(tickets) > 0
    return tickets[0]

def test_1_start_verification_session():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    res = client.post(
        "/api/verification/start",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"ticket_id": ticket["id"]}
    )
    assert res.status_code == 201
    session = res.json()
    assert session["ticket_id"] == ticket["id"]
    assert session["status"] == "IN_PROGRESS"
    assert session["challenge_type"] == "CAPTURE_AREA_VERIFICATION"
    assert "Capture" in session["challenge_text"]
    assert session["expires_at"] is not None

    # Verify ticket status updated to PENDING_VERIFICATION
    tkt_res = client.get(f"/api/tickets/{ticket['id']}", headers={"Authorization": f"Bearer {worker_token}"})
    assert tkt_res.json()["status"] == "PENDING_VERIFICATION"

def test_2_submit_verification_evidence():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    # Start session
    start_res = client.post(
        "/api/verification/start",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"ticket_id": ticket["id"]}
    )
    session_id = start_res.json()["id"]

    # Submit evidence snapshot
    img_bytes = create_dummy_image_bytes("JPEG", 160, 160)
    files = {"file": ("live_capture.jpg", img_bytes, "image/jpeg")}
    data = {
        "source_type": "LIVE_CAMERA",
        "latitude": 12.9716,
        "longitude": 77.5946
    }

    sub_res = client.post(
        f"/api/verification/{session_id}/submit",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data=data
    )
    assert sub_res.status_code == 200
    session = sub_res.json()
    assert session["status"] in ("SUBMITTED", "COMPLETED")
    assert session["completed_at"] is not None

def test_3_duplicate_submission_prevented():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    # Start session
    start_res = client.post(
        "/api/verification/start",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"ticket_id": ticket["id"]}
    )
    session_id = start_res.json()["id"]

    # Submit once
    img_bytes1 = create_dummy_image_bytes("JPEG", 140, 140)
    files1 = {"file": ("capture1.jpg", img_bytes1, "image/jpeg")}
    client.post(
        f"/api/verification/{session_id}/submit",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files1,
        data={"source_type": "LIVE_CAMERA"}
    )

    # Duplicate Submit
    img_bytes2 = create_dummy_image_bytes("JPEG", 150, 150)
    files2 = {"file": ("capture2.jpg", img_bytes2, "image/jpeg")}
    dup_res = client.post(
        f"/api/verification/{session_id}/submit",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files2,
        data={"source_type": "LIVE_CAMERA"}
    )
    assert dup_res.status_code == 400
    assert "duplicate" in dup_res.json()["detail"].lower()

def test_4_unassigned_worker_start_session_denied():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    worker_token = get_token("worker@meikaan.gov", "Worker@123")

    # Find ticket NOT assigned to worker
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    unassigned_ticket = next((t for t in res.json() if t["assigned_worker_id"] is None), None)
    if not unassigned_ticket:
        from app.db.session import SessionLocal
        from app.models.entities import Ward
        db = SessionLocal()
        ward = db.query(Ward).first()
        ward_id = ward.id if ward else None
        db.close()

        res_create = client.post(
            "/api/tickets",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={
                "title": "Unassigned verification test complaint",
                "complaint_type": "STAGNANT_WATER",
                "description": "Unassigned verification test complaint",
                "ward_id": ward_id,
                "latitude": 12.9716,
                "longitude": 77.5946
            }
        )
        unassigned_ticket = res_create.json()

    denied_res = client.post(
        "/api/verification/start",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"ticket_id": unassigned_ticket["id"]}
    )
    assert denied_res.status_code == 403
    assert "access denied" in denied_res.json()["detail"].lower()
