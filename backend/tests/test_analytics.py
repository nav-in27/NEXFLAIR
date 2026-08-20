"""
Phase 13 – Admin Dashboard & Analytics API Tests
================================================
Tests the Analytics API endpoints:
- GET /api/analytics/dashboard (real-time metrics, status distribution, avg integrity score)
- GET /api/analytics/wards (ward level ticket breakdown & suspicious %)
- GET /api/analytics/workers (Verification Risk Indicators table)
- GET /api/analytics/audit (system audit logs)
- Authorization: Field workers denied (403) from analytics endpoints.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def _get_token(email: str = "admin@meikaan.gov", password: str = "Admin@123") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return ""


class TestAnalyticsAPI:

    def test_get_dashboard_analytics(self):
        """Admin can fetch real-time dashboard analytics."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        assert token != ""

        resp = client.get(
            "/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()

        assert "total_tickets" in data
        assert "pending_verification" in data
        assert "verified" in data
        assert "human_review" in data
        assert "suspicious" in data
        assert "average_integrity_score" in data
        assert "verification_distribution" in data
        assert "ward_suspicious_rates" in data

    def test_get_ward_analytics(self):
        """Admin can fetch ward-level analytics."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        assert token != ""

        resp = client.get(
            "/api/analytics/wards",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            item = data[0]
            assert "ward_name" in item
            assert "total_tickets" in item
            assert "suspicious_percentage" in item

    def test_get_worker_analytics_verification_risk_indicators(self):
        """Admin can fetch worker Verification Risk Indicators."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        assert token != ""

        resp = client.get(
            "/api/analytics/workers",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        if len(data) > 0:
            item = data[0]
            assert "worker_code" in item
            assert "worker_name" in item
            assert "average_integrity_score" in item
            assert "evidence_reuse_flags" in item
            assert "temporal_anomalies" in item

    def test_get_audit_logs(self):
        """Admin can fetch system audit logs."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        assert token != ""

        resp = client.get(
            "/api/analytics/audit",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_worker_access_denied_to_analytics(self):
        """Field workers are forbidden (HTTP 403) from accessing analytics."""
        token = _get_token("worker@meikaan.gov", "Worker@123")
        assert token != ""

        resp = client.get(
            "/api/analytics/dashboard",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 403
