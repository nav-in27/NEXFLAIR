import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.entities import UserRole

client = TestClient(app)

def test_1_admin_login():
    response = client.post("/api/auth/login", json={
        "email": "admin@meikaan.gov",
        "password": "Admin@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "admin@meikaan.gov"
    assert data["user"]["role"] == UserRole.ADMIN.value

def test_2_worker_login():
    response = client.post("/api/auth/login", json={
        "email": "worker@meikaan.gov",
        "password": "Worker@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "worker@meikaan.gov"
    assert data["user"]["role"] == UserRole.FIELD_WORKER.value

def test_3_reviewer_login():
    response = client.post("/api/auth/login", json={
        "email": "reviewer@meikaan.gov",
        "password": "Reviewer@123"
    })
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["user"]["email"] == "reviewer@meikaan.gov"
    assert data["user"]["role"] == UserRole.REVIEWER.value

def test_4_invalid_password():
    response = client.post("/api/auth/login", json={
        "email": "admin@meikaan.gov",
        "password": "WrongPassword123!"
    })
    assert response.status_code == 401
    assert "detail" in response.json()

def test_5_unauthorized_endpoint():
    response = client.get("/api/auth/me")
    assert response.status_code == 401

def test_6_role_restriction():
    # Login as FIELD_WORKER
    login_res = client.post("/api/auth/login", json={
        "email": "worker@meikaan.gov",
        "password": "Worker@123"
    })
    token = login_res.json()["access_token"]
    
    # Try accessing admin-only route with FIELD_WORKER token
    response = client.get(
        "/api/v1/auth/admin-only",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 403
    assert "not permitted" in response.json()["detail"].lower()
