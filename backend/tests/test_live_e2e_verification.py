import os
import io
import uuid
import datetime
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, TicketEvidence, User, Worker, Ward, TicketStatus
from app.core.security import create_access_token

client = TestClient(app)

IMG_POTHOLE_SRC = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582790.png"
IMG_FIXED_SRC = r"C:\Users\navee\.gemini\antigravity-ide\brain\09319307-3ad3-4dbe-824b-f7472d808f59\.user_uploaded\media_1787248582742.png"

def create_sample_road_images():
    """Reads the genuine BEFORE (pothole) and AFTER (smooth repair) images and ensures unique hashes for the live test."""
    with open(IMG_POTHOLE_SRC, "rb") as f:
        b_bytes = f.read()
    with open(IMG_FIXED_SRC, "rb") as f:
        a_bytes = f.read()

    # Append a tiny unique byte tag to make hashes unique to this live run
    run_tag = uuid.uuid4().bytes[:8]
    return b_bytes + run_tag, a_bytes + run_tag

def run_real_e2e_lifecycle():
    print("--- 1. CITIZEN GRIEVANCE SUBMISSION ---")
    b_jpg, a_jpg = create_sample_road_images()
    import base64
    b_b64 = "data:image/jpeg;base64," + base64.b64encode(b_jpg).decode("utf-8")
    
    cit_payload = {
        "complaint_type": "ROAD_DEFECT",
        "description": "Severe pothole causing vehicle hazard near 5th Main.",
        "latitude": 13.0031,
        "longitude": 77.5643,
        "accuracy_meters": 12.0,
        "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "location_source": "device_gps",
        "location_status": "GPS_CAPTURED",
        "photo_base64": b_b64
    }
    res_cit = client.post("/api/tickets/public", json=cit_payload)
    assert res_cit.status_code == 201, f"Citizen creation failed: {res_cit.text}"
    ticket_data = res_cit.json()
    ticket_id = ticket_data["id"]
    ticket_num = ticket_data["ticket_number"]
    print(f"Created Ticket: ID={ticket_id}, Number={ticket_num}, Status={ticket_data['status']}")
    assert ticket_data["latitude"] == 13.0031
    assert ticket_data["longitude"] == 77.5643
    assert ticket_data["status"] in ("ASSIGNED", "OPEN")
    assert ticket_data["status"] != "INSPECTED"

    print("\n--- 2. WORKER AUTHENTICATION & TASK START ---")
    db = SessionLocal()
    # Create an isolated worker for this test run
    test_user = User(
        email=f"worker_live_{uuid.uuid4().hex[:6]}@meikaan.gov",
        full_name="Rajesh Kumar",
        role="FIELD_WORKER",
        hashed_password="mock",
        is_active=True
    )
    db.add(test_user)
    db.commit()
    test_worker = Worker(user_id=test_user.id, worker_code=f"WK-{uuid.uuid4().hex[:4]}", status="ACTIVE")
    db.add(test_worker)
    db.commit()

    # Assign ticket to this worker
    db_ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    db_ticket.assigned_worker_id = test_worker.id
    db.commit()

    token = create_access_token({"sub": str(test_user.id), "role": test_user.role.value, "user_id": test_user.id})
    headers = {"Authorization": f"Bearer {token}"}

    # Worker starts task
    start_payload = {
        "latitude": 13.00315,
        "longitude": 77.56432,
        "accuracy_meters": 15.0,
        "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "location_source": "device_gps"
    }
    res_start = client.post(f"/api/tickets/{ticket_id}/start-task", json=start_payload, headers=headers)
    assert res_start.status_code == 200, f"Worker start failed: {res_start.text}"
    assert res_start.json()["status"] == "IN_PROGRESS"
    print(f"Worker started task {ticket_num}. Status updated to IN_PROGRESS.")

    print("\n--- 3. WORKER EVIDENCE SUBMISSION & VERIFICATION ---")
    # Start verification session
    res_sess = client.post("/api/v1/verification/start", json={"ticket_id": ticket_id}, headers=headers)
    assert res_sess.status_code == 201, f"Start session failed: {res_sess.text}"
    session_data = res_sess.json()
    session_id = session_data["id"]
    print(f"Verification session started: ID={session_id}")

    # Submit evidence (LIVE_CAMERA)
    files = {"file": ("repaired_road.jpg", a_jpg, "image/jpeg")}
    data = {
        "source_type": "LIVE_CAMERA",
        "latitude": 13.00315,
        "longitude": 77.56432,
        "accuracy_meters": 15.0,
        "location_source": "device_gps"
    }
    res_submit = client.post(f"/api/v1/verification/{session_id}/submit", files=files, data=data, headers=headers)
    assert res_submit.status_code == 200, f"Evidence submission failed: {res_submit.text}"
    result = res_submit.json()
    print("Verification result received:")
    print(f"  Decision: {result.get('integrity_status')}")
    print(f"  Score: {result.get('integrity_score')}")
    loc_detail = result.get("detailed_result", {}).get("location", {})
    print(f"  Location Status: {loc_detail.get('status')}")
    print(f"  Distance: {loc_detail.get('distance_meters')} m")
    print(f"  Device Accuracy: ±{loc_detail.get('accuracy_meters')} m")
    print(f"  Allowed Tolerance: ±{loc_detail.get('tolerance_meters')} m")

    assert result.get("integrity_status") in ("VERIFIED", "HUMAN_REVIEW")
    assert loc_detail.get("status") == "GPS_PASS"
    assert loc_detail.get("distance_meters") is not None
    assert loc_detail.get("tolerance_meters") is not None

    print("\n--- 4. MUNICIPAL REVIEWER QUEUE & GOVERNANCE ---")
    rev_user = db.query(User).filter(User.email == "reviewer@meikaan.gov").first()
    rev_token = create_access_token({"sub": str(rev_user.id), "role": rev_user.role.value, "user_id": rev_user.id})
    rev_headers = {"Authorization": f"Bearer {rev_token}"}
    res_ticket_detail = client.get(f"/api/tickets/{ticket_id}", headers=rev_headers)
    assert res_ticket_detail.status_code == 200
    db_ticket = res_ticket_detail.json()
    print(f"Reviewer inspected ticket {db_ticket['ticket_number']}: Final Status = {db_ticket['status']}")
    db.close()
    print("\n>>> ALL REAL E2E LIFECYCLE CHECKS COMPLETED WITH 100% SUCCESS <<<")

if __name__ == "__main__":
    run_real_e2e_lifecycle()
