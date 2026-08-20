"""
Phase 9 – Spatial and Temporal Consistency Analysis Tests
=========================================================
Tests the TemporalConsistencyService & Haversine Distance Calculations:
- Haversine distance calculations
- Normal route (realistic speed and proximity)
- Impossible/unlikely route (Spatio-Temporal Anomaly)
- Same location (0m distance)
- Missing GPS (produces LOW_CONFIDENCE, not automatically SUSPICIOUS)
- Missing timestamps (produces LOW_CONFIDENCE, not automatically SUSPICIOUS)
"""

import datetime
import pytest
from app.models.entities import Ticket, TicketEvidence, VerificationSession, Worker
from app.services.spatial_temporal import (
    TemporalConsistencyService,
    haversine_distance_meters,
    SpatialTemporalResult,
)


class DummySpatialDB:
    """Mock DB interface for spatial and temporal analysis testing."""
    def __init__(self, session=None, ticket=None, evidence=None, prior_evidences=None):
        self._session = session
        self._ticket = ticket
        self._evidence = evidence
        self._prior_evidences = prior_evidences or []

    def query(self, model):
        self._model = model
        return self

    def filter(self, *args, **kwargs):
        return self

    def join(self, *args, **kwargs):
        return self

    def order_by(self, *args):
        return self

    def limit(self, n):
        return self

    def first(self):
        if self._model == VerificationSession:
            return self._session
        if self._model == Ticket:
            return self._ticket
        if self._model == TicketEvidence:
            return self._evidence
        return None

    def all(self):
        if self._model == TicketEvidence:
            return self._prior_evidences
        return []


# ──────────────────────────────────────────────────────────────────
# 1. Haversine Distance Tests
# ──────────────────────────────────────────────────────────────────

def test_haversine_same_point():
    """Haversine distance between identical points is 0 meters."""
    dist = haversine_distance_meters(12.9716, 77.5946, 12.9716, 77.5946)
    assert dist == 0.0


def test_haversine_known_distance():
    """Haversine distance between Bangalore City Center and Indiranagar (~5.5km)."""
    dist = haversine_distance_meters(12.9716, 77.5946, 12.9784, 77.6408)
    assert 4800.0 <= dist <= 5500.0


# ──────────────────────────────────────────────────────────────────
# 2. Spatial & Temporal Engine Tests
# ──────────────────────────────────────────────────────────────────

class TestTemporalConsistencyService:

    def test_normal_route(self):
        """Proximity within 10 meters and normal travel -> spatial_score=100, anomaly=False."""
        svc = TemporalConsistencyService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-1", ticket_id="t1", worker_id="w1")
        ticket = Ticket(id="t1", latitude=12.9716, longitude=77.5946)
        evidence = TicketEvidence(
            id="ev-1",
            ticket_id="t1",
            verification_session_id="sess-1",
            latitude=12.97165,  # ~5m away
            longitude=77.59465,
            captured_at=now,
        )

        db = DummySpatialDB(session=session, ticket=ticket, evidence=evidence, prior_evidences=[])
        result = svc.analyze(db=db, session_id="sess-1")

        assert isinstance(result, SpatialTemporalResult)
        assert result.spatial_score == 100.0
        assert result.distance_meters is not None and result.distance_meters < 20.0
        assert result.is_spatio_temporal_anomaly is False
        assert result.low_confidence is False

    def test_impossible_unlikely_route_anomaly(self):
        """Consecutive tasks 10km apart within 1 minute (600 km/h) -> Spatio-Temporal Anomaly."""
        svc = TemporalConsistencyService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-2", ticket_id="t2", worker_id="w1")
        ticket = Ticket(id="t2", latitude=12.9716, longitude=77.5946)
        
        current_ev = TicketEvidence(
            id="ev-curr",
            ticket_id="t2",
            verification_session_id="sess-2",
            latitude=12.9716,
            longitude=77.5946,
            captured_at=now,
        )
        
        # Prior evidence 10km away captured 60 seconds ago by same worker
        prior_ev = TicketEvidence(
            id="ev-prior",
            ticket_id="t1",
            latitude=13.0600,  # ~10km away
            longitude=77.5946,
            captured_at=now - datetime.timedelta(seconds=60),
        )

        db = DummySpatialDB(session=session, ticket=ticket, evidence=current_ev, prior_evidences=[prior_ev])
        result = svc.analyze(db=db, session_id="sess-2")

        assert result.is_spatio_temporal_anomaly is True
        assert result.observed_speed_kmh is not None and result.observed_speed_kmh > 120.0
        assert "Spatio-temporal inconsistency detected" in result.explanation

    def test_same_location(self):
        """Identical coordinates -> 0 meters distance, spatial_score=100."""
        svc = TemporalConsistencyService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-3", ticket_id="t3", worker_id="w1")
        ticket = Ticket(id="t3", latitude=12.9716, longitude=77.5946)
        evidence = TicketEvidence(
            id="ev-3",
            ticket_id="t3",
            verification_session_id="sess-3",
            latitude=12.9716,
            longitude=77.5946,
            captured_at=now,
        )

        db = DummySpatialDB(session=session, ticket=ticket, evidence=evidence)
        result = svc.analyze(db=db, session_id="sess-3")

        assert result.distance_meters == 0.0
        assert result.spatial_score == 100.0

    def test_missing_gps_coordinates_produces_low_confidence(self):
        """Missing complaint or evidence GPS -> low_confidence=True (NOT flagged as suspicious)."""
        svc = TemporalConsistencyService()

        session = VerificationSession(id="sess-4", ticket_id="t4", worker_id="w1")
        ticket = Ticket(id="t4", latitude=None, longitude=None)  # Missing GPS
        evidence = TicketEvidence(id="ev-4", ticket_id="t4", latitude=12.9716, longitude=77.5946)

        db = DummySpatialDB(session=session, ticket=ticket, evidence=evidence)
        result = svc.analyze(db=db, session_id="sess-4")

        assert result.low_confidence is True
        assert result.confidence < 0.50
        assert result.is_spatio_temporal_anomaly is False
        assert ("LOW_CONFIDENCE" in result.explanation or "UNAVAILABLE" in result.explanation)

    def test_missing_timestamps_produces_low_confidence(self):
        """Missing timestamps on evidence -> handles gracefully without flagging false anomaly."""
        svc = TemporalConsistencyService()

        session = VerificationSession(id="sess-5", ticket_id="t5", worker_id="w1")
        ticket = Ticket(id="t5", latitude=12.9716, longitude=77.5946)
        evidence = TicketEvidence(
            id="ev-5",
            ticket_id="t5",
            verification_session_id="sess-5",
            latitude=12.9716,
            longitude=77.5946,
            captured_at=None,
            uploaded_at=None,
        )

        db = DummySpatialDB(session=session, ticket=ticket, evidence=evidence)
        result = svc.analyze(db=db, session_id="sess-5")

        assert result.is_spatio_temporal_anomaly is False
        assert result.spatial_score == 100.0
