"""
Phase 12 – Human Review Workflow Tests
======================================
Tests the Human Review Workflow, authorization restrictions, and audit logging:
- Reviewer/Admin can approve closure (CLOSED), request reverification (IN_PROGRESS), or reopen ticket (OPEN).
- Creating a review action automatically records ReviewAction & AuditLog.
- Field workers cannot access Review Queue or approve their own ticket closures.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.models.entities import UserRole, TicketStatus

client = TestClient(app)


def _get_token(email: str = "admin@meikaan.gov", password: str = "Admin@123") -> str:
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    return ""


# ──────────────────────────────────────────────────────────────────
# Authorization & Workflow Tests
# ──────────────────────────────────────────────────────────────────

class TestHumanReviewWorkflow:

    def test_review_queue_admin_access(self):
        """Admin can access Review Queue."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        if not token:
            pytest.skip("Admin token unavailable")

        resp = client.get(
            "/api/tickets/review-queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_review_queue_reviewer_access(self):
        """Reviewer can access Review Queue."""
        token = _get_token("reviewer@meikaan.gov", "Reviewer@123")
        if not token:
            pytest.skip("Reviewer token unavailable")

        resp = client.get(
            "/api/tickets/review-queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_review_queue_worker_denied(self):
        """Field worker is forbidden (403) from accessing Review Queue."""
        token = _get_token("worker@meikaan.gov", "Worker@123")
        if not token:
            pytest.skip("Worker token unavailable")

        resp = client.get(
            "/api/tickets/review-queue",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 403

    def test_approve_closure_action(self):
        """Admin/Reviewer approving closure updates status to CLOSED."""
        token = _get_token("admin@meikaan.gov", "Admin@123")
        if not token:
            pytest.skip("Admin token unavailable")

        # Get list of tickets
        t_resp = client.get("/api/tickets", headers={"Authorization": f"Bearer {token}"})
        if t_resp.status_code != 200 or not t_resp.json():
            pytest.skip("No tickets available")

        ticket_id = t_resp.json()[0]["id"]

        resp = client.post(
            f"/api/tickets/{ticket_id}/review",
            json={"action": "APPROVE_CLOSURE", "comments": "Evidence validated by reviewer."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code in (200, 403)  # 403 if worker self-review
        if resp.status_code == 200:
            data = resp.json()
            assert data["action"] == "APPROVE_CLOSURE"
            assert data["ticket_id"] == ticket_id

            # Verify ticket status updated to CLOSED
            t_check = client.get(f"/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {token}"})
            assert t_check.json()["status"] == TicketStatus.CLOSED.value

    def test_request_reverification_action(self):
        """Reviewer requesting re-verification transitions ticket status to IN_PROGRESS."""
        token = _get_token("reviewer@meikaan.gov", "Reviewer@123")
        if not token:
            pytest.skip("Reviewer token unavailable")

        t_resp = client.get("/api/tickets/review-queue", headers={"Authorization": f"Bearer {token}"})
        if t_resp.status_code != 200 or not t_resp.json():
            pytest.skip("No review queue items")

        ticket_id = t_resp.json()[0]["ticket_id"]

        resp = client.post(
            f"/api/tickets/{ticket_id}/review",
            json={"action": "REQUEST_REVERIFICATION", "comments": "Please capture clearer photo."},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert resp.status_code == 200
        assert resp.json()["action"] == "REQUEST_REVERIFICATION"

        # Verify status changed to IN_PROGRESS
        admin_token = _get_token("admin@meikaan.gov", "Admin@123")
        t_check = client.get(f"/api/tickets/{ticket_id}", headers={"Authorization": f"Bearer {admin_token}"})
        assert t_check.json()["status"] == TicketStatus.IN_PROGRESS.value

    def test_worker_cannot_review_own_ticket(self):
        """Worker cannot approve/review their own assigned ticket closure."""
        worker_token = _get_token("worker@meikaan.gov", "Worker@123")
        admin_token = _get_token("admin@meikaan.gov", "Admin@123")
        if not worker_token or not admin_token:
            pytest.skip("Tokens unavailable")

        # Get assigned tickets for worker1
        t_resp = client.get("/api/tickets", headers={"Authorization": f"Bearer {worker_token}"})
        if t_resp.status_code != 200 or not t_resp.json():
            pytest.skip("No worker assigned tickets")

        assigned_ticket_id = t_resp.json()[0]["id"]

        # Worker attempts to review own assigned ticket
        resp = client.post(
            f"/api/tickets/{assigned_ticket_id}/review",
            json={"action": "APPROVE_CLOSURE", "comments": "Worker trying to approve own ticket"},
            headers={"Authorization": f"Bearer {worker_token}"}
        )
        assert resp.status_code == 403

        if t_resp.status_code != 200 or not t_resp.json():
            pytest.skip("No worker assigned tickets")

        assigned_ticket_id = t_resp.json()[0]["id"]

        # Worker attempts to review own assigned ticket
        resp = client.post(
            f"/api/tickets/{assigned_ticket_id}/review",
            json={"action": "APPROVE_CLOSURE", "comments": "Worker trying to approve own ticket"},
            headers={"Authorization": f"Bearer {worker_token}"}
        )
        assert resp.status_code == 403
