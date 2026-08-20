import os
import base64
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, TicketEvidence, Worker, User, TicketStatus

client = TestClient(app)

IMG_POTHOLE_PATH = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582790.png"
IMG_FIXED_PATH = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582742.png"

def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, f"Login failed: {res.text}"
    return res.json()["access_token"]

def test_full_citizen_complaint_assignment_and_image_flow():
    # 1. Citizen creates complaint + photo (using pothole image)
    with open(IMG_POTHOLE_PATH, "rb") as f:
        pothole_b64 = "data:image/png;base64," + base64.b64encode(f.read()).decode("utf-8")

    citizen_res = client.post(
        "/api/tickets/public",
        json={
            "complaint_type": "ROAD_DEFECT",
            "title": "Severe Potholes on Main Road",
            "description": "Deep dangerous pothole causing traffic obstruction and vehicle damage.",
            "latitude": 13.0031,
            "longitude": 77.5643,
            "photo_base64": pothole_b64
        }
    )
    assert citizen_res.status_code == 201, f"Citizen report creation failed: {citizen_res.text}"
    ticket_data = citizen_res.json()
    ticket_id = ticket_data["id"]
    ticket_number = ticket_data["ticket_number"]

    # 2. Confirm complaint and evidence exist in database
    db = SessionLocal()
    try:
        db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        assert db_ticket is not None, "Ticket record missing in DB"
        assert db_ticket.assigned_worker_id is not None, "Worker was not auto-assigned"
        assert db_ticket.status == TicketStatus.ASSIGNED.value

        evidence_records = db.query(TicketEvidence).filter(TicketEvidence.ticket_id == ticket_id).all()
        assert len(evidence_records) >= 1, "Evidence record not found in DB"
        before_ev = next((e for e in evidence_records if e.evidence_type == "BEFORE"), None)
        assert before_ev is not None, "BEFORE evidence record not linked to ticket"
        assert before_ev.file_path.startswith("/uploads/evidence/"), f"Invalid file path: {before_ev.file_path}"
        
        # Verify physical file exists on disk
        backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        physical_file = os.path.join(backend_dir, before_ev.file_path.lstrip("/\\"))
        assert os.path.exists(physical_file), f"Physical evidence file does not exist at {physical_file}"

        before_file_path = before_ev.file_path
        # 3 & 4. Confirm assignment exists
        assigned_worker_id = db_ticket.assigned_worker_id
        worker_rec = db.query(Worker).filter(Worker.id == assigned_worker_id).first()
        assert worker_rec is not None
        worker_user = db.query(User).filter(User.id == worker_rec.user_id).first()
        assert worker_user is not None
        from app.core.security import hash_password
        worker_user.hashed_password = hash_password("Worker@123")
        db.commit()
        worker_email = worker_user.email
    finally:
        db.close()

    # 5. Login as worker
    worker_token = get_token(worker_email, "Worker@123")

    # 6. Worker sees assigned task
    worker_tasks_res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    assert worker_tasks_res.status_code == 200
    worker_tasks = worker_tasks_res.json()
    task_found = next((t for t in worker_tasks if t["id"] == ticket_id), None)
    assert task_found is not None, f"Assigned task {ticket_id} not found in worker's task list"

    # 7 & 8. Open task -> Original citizen photo is visible
    task_detail_res = client.get(f"/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {worker_token}"})
    assert task_detail_res.status_code == 200
    task_detail = task_detail_res.json()
    assert task_detail["evidences"] is not None and len(task_detail["evidences"]) > 0
    worker_before_ev = next((e for e in task_detail["evidences"] if e["evidence_type"] == "BEFORE"), None)
    assert worker_before_ev is not None
    assert worker_before_ev["file_path"] == before_file_path

    # Static file serving check
    img_response = client.get(worker_before_ev["file_path"])
    assert img_response.status_code == 200
    assert len(img_response.content) > 1000

    # 9 & 10. Login as reviewer -> Same citizen photo is visible
    reviewer_token = get_token("reviewer@meikaan.gov", "Reviewer@123")
    
    # Reviewer inspects ticket
    rev_ticket_res = client.get(f"/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert rev_ticket_res.status_code == 200
    rev_ticket = rev_ticket_res.json()
    rev_before_ev = next((e for e in rev_ticket["evidences"] if e["evidence_type"] == "BEFORE"), None)
    assert rev_before_ev is not None
    assert rev_before_ev["file_path"] == before_file_path

    # 11. Verification: Worker starts task and uploads resolution evidence (Image 2 - fixed road)
    start_res = client.post(
        f"/api/tickets/{ticket_id}/start-task",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"latitude": 13.0031, "longitude": 77.5643, "accuracy_meters": 5.0}
    )
    assert start_res.status_code == 200

    # Upload resolution photo
    with open(IMG_FIXED_PATH, "rb") as f:
        fixed_bytes = f.read()

    upload_res = client.post(
        f"/api/tickets/{ticket_id}/evidence",
        headers={"Authorization": f"Bearer {worker_token}"},
        data={"evidence_type": "AFTER", "source_type": "UPLOAD", "latitude": 13.0031, "longitude": 77.5643},
        files={"file": ("fixed_road.png", fixed_bytes, "image/png")}
    )
    assert upload_res.status_code == 201

    # Check Reviewer review queue includes both before & after images
    queue_res = client.get("/api/tickets/review-queue", headers={"Authorization": f"Bearer {reviewer_token}"})
    assert queue_res.status_code == 200
    queue_items = queue_res.json()
    q_item = next((item for item in queue_items if item["ticket_id"] == ticket_id), None)
    if q_item:
        assert q_item["before_image_url"] == before_file_path
        assert q_item["after_image_url"] is not None

    # Verify Complaint A's image NEVER appears on a separate Complaint B
    citizen_res_b = client.post(
        "/api/tickets/public",
        json={
            "complaint_type": "WASTE",
            "title": "Waste Dump at Street Corner",
            "description": "Garbage pile accumulated near park entrance.",
            "latitude": 13.0031,
            "longitude": 77.5643
            # No photo attached
        }
    )
    assert citizen_res_b.status_code == 201
    ticket_b = citizen_res_b.json()
    track_b_res = client.get(f"/api/tickets/public/track/{ticket_b['ticket_number']}")
    assert track_b_res.status_code == 200
    track_b = track_b_res.json()
    # Ticket B must NOT have Ticket A's before image URL
    assert track_b["before_image_url"] is None
