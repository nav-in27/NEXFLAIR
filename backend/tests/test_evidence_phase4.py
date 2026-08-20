import io
import uuid
import pytest
from PIL import Image
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def create_unique_image_bytes(format_name: str = "JPEG", width: int = 100, height: int = 100) -> bytes:
    # Use random pixels to guarantee unique SHA-256 hash per test run
    r = (hash(uuid.uuid4()) % 250) + 1
    g = (hash(uuid.uuid4()) % 250) + 1
    b = (hash(uuid.uuid4()) % 250) + 1
    img = Image.new("RGB", (width, height), color=(r, g, b))
    buf = io.BytesIO()
    img.save(buf, format=format_name)
    return buf.getvalue()

def get_assigned_ticket(worker_token: str):
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    assert res.status_code == 200
    tickets = res.json()
    if len(tickets) > 0:
        return tickets[0]
    
    # Create test ticket dynamically
    res_pub = client.post("/api/v1/tickets/public", json={
        "complaint_type": "STAGNANT_WATER",
        "description": "Test complaint for evidence testing",
        "latitude": 12.9716,
        "longitude": 77.5946
    })
    ticket = res_pub.json()

    # Assign to worker via DB session
    from app.db.session import SessionLocal
    from app.models.entities import Ticket, Worker, User
    db = SessionLocal()
    try:
        user_w = db.query(User).filter(User.email == "worker@meikaan.gov").first()
        worker_rec = db.query(Worker).filter(Worker.user_id == user_w.id).first()
        t = db.query(Ticket).filter(Ticket.id == ticket["id"]).first()
        if t and worker_rec:
            t.assigned_worker_id = worker_rec.id
            t.status = "ASSIGNED"
            db.commit()
    finally:
        db.close()

    return ticket

def test_1_valid_image_upload():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)
    
    img_bytes = create_unique_image_bytes("JPEG", 200, 200)
    files = {"file": (f"stagnant_{uuid.uuid4().hex[:6]}.jpg", img_bytes, "image/jpeg")}
    data = {
        "evidence_type": "BEFORE",
        "source_type": "LIVE_CAMERA",
        "latitude": 12.9716,
        "longitude": 77.5946
    }
    
    res = client.post(
        f"/api/tickets/{ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data=data
    )
    assert res.status_code == 201
    payload = res.json()
    assert payload["ticket_id"] == ticket["id"]
    assert payload["evidence_type"] == "BEFORE"
    assert payload["source_type"] == "LIVE_CAMERA"
    assert len(payload["sha256_hash"]) == 64
    assert payload["width"] == 200
    assert payload["height"] == 200

def test_2_invalid_file_type():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    invalid_bytes = b"MALICIOUS SCRIPT PAYLOAD OR TEXT CONTENT"
    files = {"file": ("payload.exe", invalid_bytes, "application/octet-stream")}
    
    res = client.post(
        f"/api/tickets/{ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data={"evidence_type": "BEFORE", "source_type": "UPLOAD"}
    )
    assert res.status_code == 400
    assert "unsupported" in res.json()["detail"].lower() or "invalid" in res.json()["detail"].lower()

def test_3_oversized_file():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    oversized_bytes = b"0" * (11 * 1024 * 1024)
    files = {"file": ("giant_image.jpg", oversized_bytes, "image/jpeg")}
    
    res = client.post(
        f"/api/tickets/{ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data={"evidence_type": "BEFORE", "source_type": "UPLOAD"}
    )
    assert res.status_code == 400
    assert "exceeds" in res.json()["detail"].lower()

def test_4_duplicate_file_hash():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    ticket = get_assigned_ticket(worker_token)

    unique_bytes = create_unique_image_bytes("PNG", 150, 150)
    files = {"file": ("unique_evidence.png", unique_bytes, "image/png")}
    
    # First Upload
    res1 = client.post(
        f"/api/tickets/{ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data={"evidence_type": "AFTER", "source_type": "UPLOAD"}
    )
    assert res1.status_code == 201

    # Second Upload with same identical bytes on same ticket
    files_dup = {"file": ("unique_evidence_copy.png", unique_bytes, "image/png")}
    res2 = client.post(
        f"/api/tickets/{ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files_dup,
        data={"evidence_type": "AFTER", "source_type": "UPLOAD"}
    )
    assert res2.status_code == 400
    assert "duplicate" in res2.json()["detail"].lower()

def test_5_unauthorized_upload():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    tkt_res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    ticket_id = tkt_res.json()[0]["id"]

    img_bytes = create_unique_image_bytes("JPEG")
    files = {"file": ("test.jpg", img_bytes, "image/jpeg")}
    
    # Upload without Authorization header
    res = client.post(f"/api/tickets/{ticket_id}/evidence", files=files, data={"evidence_type": "BEFORE"})
    assert res.status_code == 401

def test_6_worker_uploading_to_another_workers_ticket():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    worker_token = get_token("worker@meikaan.gov", "Worker@123")

    # Admin finds ticket NOT assigned to worker
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    tickets = res.json()
    unassigned_ticket = next((t for t in tickets if t["assigned_worker_id"] is None), None)
    
    if not unassigned_ticket:
        # Get ward ID
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
                "title": "Unassigned test complaint",
                "complaint_type": "STAGNANT_WATER",
                "description": "Unassigned test complaint",
                "ward_id": ward_id,
                "latitude": 12.9716,
                "longitude": 77.5946
            }
        )
        unassigned_ticket = res_create.json()

    img_bytes = create_unique_image_bytes("JPEG", 120, 120)
    files = {"file": ("unauthorized_attempt.jpg", img_bytes, "image/jpeg")}

    res = client.post(
        f"/api/tickets/{unassigned_ticket['id']}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        files=files,
        data={"evidence_type": "BEFORE", "source_type": "UPLOAD"}
    )
    assert res.status_code == 403
    assert "access denied" in res.json()["detail"].lower()
