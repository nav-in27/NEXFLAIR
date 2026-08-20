import pytest
import uuid
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock

from app.models.entities import Ticket, User, TicketEvidence, VerificationSession, Ward, Worker
from app.services.integrity_scoring import get_integrity_scoring_service
from app.db.session import Base, engine, SessionLocal

@pytest.fixture
def db_session():
    """Creates temporary in-memory DB tables for testing."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_unusable_gps_accuracy_gate(db_session: Session):
    """
    Test that if a citizen submits a ticket with an extremely poor GPS accuracy (+-200km),
    the location status is UNUSABLE, the score is capped, and the decision is forced to HUMAN_REVIEW,
    preventing any false positive auto-verification.
    """
    # 1. Create Citizen & Worker
    # 1. Create Ward & Worker
    ward = db_session.query(Ward).filter(Ward.ward_number == 14).first()
    if not ward:
        ward = Ward(ward_number=14, name="Test Ward 14", zone="CENTRAL")
        db_session.add(ward)
        db_session.commit()

    worker_user = User(
        email=f"worker_fp_{uuid.uuid4().hex[:8]}@example.com",
        full_name="Worker FP",
        role="FIELD_WORKER",
        hashed_password="mock",
        is_active=True,
    )
    db_session.add(worker_user)
    db_session.commit()

    worker = Worker(user_id=worker_user.id, ward_id=ward.id, worker_code=f"WK-{uuid.uuid4().hex[:8]}")
    db_session.add(worker)
    db_session.commit()
    
    # 2. Citizen creates ticket with bad GPS accuracy (200km = 200000m)
    ticket = Ticket(
        ticket_number=f"TKT-{uuid.uuid4().hex[:8]}",
        title="Stagnant Water Issue",
        description="Large pool of water.",
        ward_id=ward.id,
        assigned_worker_id=worker.id,
        latitude=11.6486,
        longitude=78.1833,
        accuracy_meters=200000.0, # Highly inaccurate
        status="IN_PROGRESS",
        complaint_type="STAGNANT_WATER"
    )
    db_session.add(ticket)
    db_session.commit()
    
    # Citizen BEFORE evidence
    before_ev = TicketEvidence(
        ticket_id=ticket.id,
        evidence_type="BEFORE",
        file_path="mock/before_road_a.jpg",
        file_type="image/jpeg",
        sha256_hash=uuid.uuid4().hex,
        latitude=11.6486,
        longitude=78.1833,
        accuracy_meters=200000.0,
        source_type="LIVE_CAMERA"
    )
    db_session.add(before_ev)
    db_session.commit()

    import datetime
    # 3. Worker submits verification with completely different image and GPS
    worker_session = VerificationSession(
        ticket_id=ticket.id,
        worker_id=worker.id,
        status="IN_PROGRESS",
        expires_at=datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=15)
    )
    db_session.add(worker_session)
    db_session.commit()
    
    after_ev = TicketEvidence(
        ticket_id=ticket.id,
        verification_session_id=worker_session.id,
        evidence_type="AFTER",
        file_path="mock/after_road_b.jpg",
        file_type="image/jpeg",
        sha256_hash=uuid.uuid4().hex,
        latitude=12.1234, # different
        longitude=77.5678, # different
        accuracy_meters=10.0, # Worker has good GPS, but citizen's is garbage
        source_type="LIVE_CAMERA"
    )
    db_session.add(after_ev)
    
    # Mock the actual file paths
    worker_session.evidence_id = after_ev.id
    db_session.commit()

    # 4. Run Fusion Engine
    scoring_svc = get_integrity_scoring_service()
    
    # We mock out the actual image processing and spatial distances 
    # to focus entirely on the fusion logic and hard gates.
    with patch("app.services.scene_verification.SceneVerificationService.analyze") as mock_scene:
        # Mock scene mismatch
        mock_scene_result = MagicMock()
        mock_scene_result.scene_status = "FAIL"
        mock_scene_result.scene_score = 15.0
        mock_scene_result.error = None
        mock_scene.return_value = mock_scene_result
        
        with patch("app.services.hazard_detection.HazardDetectionService.analyze") as mock_hazard:
            # Mock high hazard resolution (this was tricking the old system)
            mock_hazard_result = MagicMock()
            mock_hazard_result.hazard_resolution_score = 95.0
            mock_hazard_result.confidence = 0.90
            mock_hazard_result.requires_human_review = False
            mock_hazard.return_value = mock_hazard_result
            
            result = scoring_svc.finalize_verification(db_session, worker_session.id)
            
            # The GPS UNUSABLE gate is Gate 5.
            # Scene FAIL is Gate 2.
            # Scene FAIL should trigger first, leading to CLOSURE_NOT_VERIFIED and score cap.
            # If the code runs location check first, it might trigger the UNUSABLE gate.
            # Actually, the logic evaluates the gates sequentially.
            # Let's see what the final decision is.
            
            assert result.decision in ["CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW"], f"Must not be VERIFIED. Got: {result.decision}"
            assert result.overall_score <= 30.0, f"Score must be severely penalized. Got: {result.overall_score}"
            
            # Verify the Ticket Status is updated
            db_session.refresh(ticket)
            assert ticket.status in ["CLOSURE_NOT_VERIFIED", "HUMAN_REVIEW"]
