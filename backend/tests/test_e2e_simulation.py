"""
MEIKAAN End-to-End Civic Evidence Verification Lifecycle Simulation
====================================================================
Simulates the complete 16-step lifecycle:
Citizen complaint -> Worker assignment -> Worker resolve -> Verification session ->
Evidence submission -> Scene analysis -> Hazard analysis -> Freshness -> Spatial ->
Temporal -> Evidence fusion -> Integrity Score -> Decision -> Human review ->
Final closure -> Audit log.
"""

import pytest
import datetime
import numpy as np
import cv2
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, Worker, Ward, User, UserRole, TicketStatus, VerificationSession, AuditLog, ReviewAction
from app.core.security import create_access_token, hash_password

client = TestClient(app)


def ensure_test_fixtures(db):
    """Ensures Admin, Worker, Reviewer users, and Ward exist in database."""
    ward = db.query(Ward).filter(Ward.ward_number == 14).first()
    if not ward:
        ward = Ward(ward_number=14, name="Ward 14 - Malleshwaram", zone="North Zone")
        db.add(ward)
        db.commit()
        db.refresh(ward)

    admin = db.query(User).filter(User.role == UserRole.ADMIN).first()
    if not admin:
        admin = User(
            email="admin@meikaan.gov",
            full_name="System Administrator",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)

    reviewer = db.query(User).filter(User.role == UserRole.REVIEWER).first()
    if not reviewer:
        reviewer = User(
            email="reviewer@meikaan.gov",
            full_name="Civic Reviewer",
            hashed_password=hash_password("reviewer123"),
            role=UserRole.REVIEWER,
            is_active=True
        )
        db.add(reviewer)
        db.commit()
        db.refresh(reviewer)

    worker = db.query(Worker).first()
    if not worker:
        worker_user = User(
            email="worker@meikaan.gov",
            full_name="Ramesh Kumar",
            hashed_password=hash_password("worker123"),
            role=UserRole.FIELD_WORKER,
            is_active=True
        )
        db.add(worker_user)
        db.commit()
        db.refresh(worker_user)

        worker = Worker(
            user_id=worker_user.id,
            worker_code="WRK-001",
            ward_id=ward.id,
            phone="9876543210"
        )
        db.add(worker)
        db.commit()
        db.refresh(worker)

    return admin, reviewer, worker, ward


class TestE2ESimulation:

    def test_complete_e2e_civic_verification_lifecycle(self):
        db = SessionLocal()
        admin_user, reviewer_user, worker, ward = ensure_test_fixtures(db)

        # Step 1: Citizen Complaint Creation
        admin_token = create_access_token({"sub": admin_user.id, "role": "ADMIN"})
        headers_admin = {"Authorization": f"Bearer {admin_token}"}

        create_payload = {
            "title": "Severe Stagnant Water Accumulation at Market Gate",
            "description": "Large stagnant water puddle posing mosquito hazard.",
            "complaint_type": "STAGNANT_WATER",
            "priority": "HIGH",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "ward_id": ward.id,
        }

        res_create = client.post("/api/tickets/", json=create_payload, headers=headers_admin)
        assert res_create.status_code == 201
        t_data = res_create.json()
        ticket_id = t_data["id"]
        assert t_data["status"] == "OPEN"

        # Step 2: Worker Assignment
        res_assign = client.patch(
            f"/api/tickets/{ticket_id}/assign",
            json={"assigned_worker_id": worker.id},
            headers=headers_admin
        )

        assert res_assign.status_code == 200
        assert res_assign.json()["status"] == "ASSIGNED"

        # Step 3: Worker Resolve / Status Update
        worker_user = db.query(User).filter(User.id == worker.user_id).first()
        worker_token = create_access_token({"sub": worker_user.id, "role": "FIELD_WORKER"})
        headers_worker = {"Authorization": f"Bearer {worker_token}"}

        res_progress = client.patch(
            f"/api/tickets/{ticket_id}/status",
            json={"status": "IN_PROGRESS"},
            headers=headers_worker
        )
        assert res_progress.status_code == 200

        # Step 4: Verification Session Initialization (15-min active timer)
        res_session = client.post(
            "/api/verification/start",
            json={
                "ticket_id": ticket_id,
            },
            headers=headers_worker
        )
        assert res_session.status_code == 201
        session_data = res_session.json()
        session_id = session_data["id"]
        assert session_data["status"] in ["ACTIVE", "IN_PROGRESS"]



        # Step 5: Evidence Submission
        dummy_img = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.rectangle(dummy_img, (50, 50), (200, 200), (255, 255, 255), -1)
        _, img_bytes = cv2.imencode(".jpg", dummy_img)

        files = {"file": ("verification.jpg", img_bytes.tobytes(), "image/jpeg")}
        data = {
            "evidence_type": "LIVE_VERIFICATION",
            "source_type": "LIVE_CAMERA",
            "latitude": "12.9716",
            "longitude": "77.5946",
            "captured_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
        }

        res_submit = client.post(
            f"/api/verification/{session_id}/submit",
            files=files,
            data=data,
            headers=headers_worker
        )
        assert res_submit.status_code in [200, 201]


        # Step 6 to 13: Evidence Fusion Engine Finalization
        res_finalize = client.post(
            f"/api/verification/{session_id}/finalize",
            headers=headers_worker
        )
        assert res_finalize.status_code == 200
        fusion_res = res_finalize.json()
        assert "overall_score" in fusion_res
        assert "decision" in fusion_res
        assert fusion_res["decision"] in ["VERIFIED", "HUMAN_REVIEW", "SUSPICIOUS", "CLOSURE_NOT_VERIFIED"]


        # Step 14: Human Review Inspection & Approval
        reviewer_token = create_access_token({"sub": reviewer_user.id, "role": "REVIEWER"})
        headers_reviewer = {"Authorization": f"Bearer {reviewer_token}"}

        res_review = client.post(
            f"/api/tickets/{ticket_id}/review",
            json={
                "action": "APPROVE_CLOSURE",
                "comments": "End-to-End simulation review approved. Resolution evidence confirmed."
            },
            headers=headers_reviewer
        )
        assert res_review.status_code == 200
        review_data = res_review.json()
        assert review_data["action"] == "APPROVE_CLOSURE"

        # Step 15 & 16: Final Ticket Closure & Audit Log Verification
        ticket_db = db.query(Ticket).filter(Ticket.id == ticket_id).first()
        assert ticket_db.status == "CLOSED"


        audit = db.query(AuditLog).filter(AuditLog.resource == f"TICKET:{ticket_id}").first()
        assert audit is not None
        assert "APPROVE_CLOSURE" in audit.action

        db.close()

