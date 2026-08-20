import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def test_1_create_ticket():
    token = get_token("admin@meikaan.gov", "Admin@123")
    
    # Fetch ward ID
    # First create or get ward
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    tickets = res.json()
    assert len(tickets) > 0
    ward_id = tickets[0]["ward_id"]

    create_res = client.post(
        "/api/tickets",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "complaint_type": "STAGNANT_WATER",
            "title": "New Water Accumulation Near School",
            "description": "Standing pool of stagnant water creating mosquito breeding hazard.",
            "latitude": 12.9750,
            "longitude": 77.5980,
            "ward_id": ward_id,
            "priority": "HIGH"
        }
    )
    assert create_res.status_code == 201
    data = create_res.json()
    assert data["complaint_type"] == "STAGNANT_WATER"
    assert data["status"] == "OPEN"
    assert "TKT-2026-" in data["ticket_number"]

def test_2_list_tickets_admin():
    token = get_token("admin@meikaan.gov", "Admin@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    tickets = res.json()
    assert isinstance(tickets, list)

def test_3_list_tickets_worker():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    assert res.status_code == 200
    tickets = res.json()
    # All returned tickets must be assigned to worker
    for tkt in tickets:
        assert tkt["assigned_worker"] is not None
        assert tkt["assigned_worker"]["email"] == "worker@meikaan.gov"

def test_4_get_ticket_details():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    ticket_id = res.json()[0]["id"]

    details_res = client.get(f"/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {admin_token}"})
    assert details_res.status_code == 200
    assert details_res.json()["id"] == ticket_id

def test_5_assign_ticket_admin():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    tickets = res.json()
    
    # Find an unassigned ticket
    unassigned_tkt = next((t for t in tickets if t["assigned_worker_id"] is None), None)
    assert unassigned_tkt is not None

    # Get worker ID from assigned ticket
    assigned_tkt = next((t for t in tickets if t["assigned_worker_id"] is not None), None)
    worker_id = assigned_tkt["assigned_worker_id"]

    assign_res = client.patch(
        f"/api/tickets/{unassigned_tkt['id']}/assign",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={"assigned_worker_id": worker_id}
    )
    assert assign_res.status_code == 200
    assert assign_res.json()["assigned_worker_id"] == worker_id
    assert assign_res.json()["status"] in ["ASSIGNED", "IN_PROGRESS", "OPEN"]

def test_6_worker_update_status():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    assigned_tkt = res.json()[0]

    status_res = client.patch(
        f"/api/tickets/{assigned_tkt['id']}/status",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"status": "IN_PROGRESS"}
    )
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "IN_PROGRESS"

def test_7_unassigned_worker_access_denied():
    admin_token = get_token("admin@meikaan.gov", "Admin@123")
    worker_token = get_token("worker@meikaan.gov", "Worker@123")

    # Get all tickets as admin to find one NOT assigned to worker
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {admin_token}"})
    tickets = res.json()
    unassigned_or_other = next((t for t in tickets if t["assigned_worker_id"] is None), None)
    
    if unassigned_or_other:
        forbidden_res = client.get(
            f"/api/tickets/{unassigned_or_other['id']}",
            headers={"Authorization": f"Bearer {worker_token}"}
        )
        assert forbidden_res.status_code == 403
        assert "access denied" in forbidden_res.json()["detail"].lower()

def test_8_non_admin_assign_denied():
    worker_token = get_token("worker@meikaan.gov", "Worker@123")
    res = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
    tkt_id = res.json()[0]["id"]

    forbidden_res = client.patch(
        f"/api/tickets/{tkt_id}/assign",
        headers={"Authorization": f"Bearer {worker_token}"},
        json={"assigned_worker_id": "dummy"}
    )
    assert forbidden_res.status_code == 403

def test_9_public_citizen_report_with_photo():
    res = client.post(
        "/api/tickets/public",
        json={
            "complaint_type": "ROAD_DEFECT",
            "description": "Large dangerous pothole on Main St",
            "ward_id": "w1",
            "photo_base64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP"
        }
    )
    assert res.status_code == 201
    data = res.json()
    assert "ticket_number" in data
    assert "id" in data or "ticket_id" in data
