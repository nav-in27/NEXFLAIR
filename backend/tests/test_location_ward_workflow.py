import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.ward_lookup import WardLookupService

client = TestClient(app)

def get_token(email: str, password: str) -> str:
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["access_token"]

def test_server_side_ward_lookup_malleshwaram():
    """Verify Point-in-Polygon correctly resolves coordinates to Ward 14 - Malleshwaram."""
    service = WardLookupService()
    result = service.resolve_ward(12.9700, 77.5900)
    assert result["ward_status"] == "DERIVED"
    assert result["ward_id"] == "w14"
    assert result["ward_name"] == "Ward 14 - Malleshwaram"
    assert result["derived_from"] == "gps_polygon"

def test_server_side_ward_lookup_missing_gps():
    """Verify missing coordinates return ward_status UNKNOWN."""
    service = WardLookupService()
    result = service.resolve_ward(None, None)
    assert result["ward_status"] == "UNKNOWN"
    assert result["ward_id"] is None
    assert result["derived_from"] == "missing_gps"

def test_ticket_creation_autoderives_ward():
    """Test public ticket creation without citizen ward input autoderives ward server-side."""
    payload = {
        "complaint_type": "WATER_SEWAGE",
        "description": "Stagnant water near Malleshwaram 8th Cross",
        "latitude": 12.9700,
        "longitude": 77.5900,
        "accuracy_meters": 6.5,
        "location_source": "device_gps",
        "location_status": "GPS_CAPTURED"
    }

    res = client.post("/api/tickets/public", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["ward_id"] is not None
    assert data["ward"]["name"] == "Ward 14 - Malleshwaram"
    assert data["latitude"] == 12.9700
    assert data["longitude"] == 77.5900
    assert data["accuracy_meters"] == 6.5
    assert data["location_status"] == "GPS_CAPTURED"

def test_worker_start_task_location_capture():
    """Test starting a task captures worker start GPS location and accuracy."""
    token = get_token("worker@meikaan.gov", "Worker@123")
    
    # Get assigned ticket for worker
    t_res = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
    assert t_res.status_code == 200
    tickets = t_res.json()
    assert len(tickets) > 0
    ticket_id = tickets[0]["id"]

    start_payload = {
        "latitude": 12.9702,
        "longitude": 77.5901,
        "accuracy_meters": 4.2,
        "captured_at": "2026-08-19T10:00:00Z",
        "location_source": "device_gps"
    }

    res = client.post(
        f"/api/tickets/{ticket_id}/start-task",
        headers={"Authorization": f"Bearer {token}"},
        json=start_payload
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "IN_PROGRESS"
    assert data["worker_start_latitude"] == 12.9702
    assert data["worker_start_longitude"] == 77.5901
    assert data["worker_start_accuracy"] == 4.2
