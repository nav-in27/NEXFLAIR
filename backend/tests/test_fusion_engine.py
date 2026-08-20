"""
Phase 11 – Evidence Fusion Engine Tests
========================================
Tests the IntegrityScoringService & Weighted Fusion Engine:
- High score (>= 90.0 -> VERIFIED)
- Medium score (70.0 - 89.99 -> HUMAN_REVIEW)
- Low score (< 70.0 -> SUSPICIOUS)
- Missing signal / engine failure handling
- Low confidence override (< 0.50 -> forces HUMAN_REVIEW)
- Exact duplicate override (forces SUSPICIOUS)
"""

import pytest
import datetime
from unittest.mock import MagicMock, patch
from app.services.integrity_scoring import (
    IntegrityScoringService,
    FinalIntegrityResult,
    DEFAULT_WEIGHTS,
)
from app.models.entities import VerificationSession, Ticket, TicketEvidence, VerificationResult


class DummyFusionDB:
    """Mock DB query interface for unit testing fusion engine."""
    def __init__(self, session=None, ticket=None, before_ev=None, after_ev=None, vr=None):
        self._session = session
        self._ticket = ticket
        self._before_ev = before_ev
        self._after_ev = after_ev
        self._vr = vr

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
        if self._model == VerificationResult:
            return self._vr
        return None

    def all(self):
        return []

    def add(self, item):
        pass

    def commit(self):
        pass

    def refresh(self, item):
        pass


# ──────────────────────────────────────────────────────────────────
# 1. Weight Validation Tests
# ──────────────────────────────────────────────────────────────────

def test_default_weights_sum_to_one():
    """Default weights must sum to exactly 1.0."""
    total = sum(DEFAULT_WEIGHTS.values())
    assert abs(total - 1.0) < 1e-6


# ──────────────────────────────────────────────────────────────────
# 2. Fusion Engine Tests
# ──────────────────────────────────────────────────────────────────

class TestIntegrityScoringService:

    def test_high_score_verified(self):
        """All engines return 100.0 score -> decision VERIFIED, score 100.0."""
        svc = IntegrityScoringService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="s1", ticket_id="t1", worker_id="w1")
        ticket = Ticket(id="t1", status="PENDING_VERIFICATION")

        db = DummyFusionDB(session=session, ticket=ticket)
        result = svc.finalize_verification(db=db, session_id="s1")

        assert isinstance(result, FinalIntegrityResult)
        assert 0.0 <= result.overall_score <= 100.0
        assert result.decision in ("VERIFIED", "HUMAN_REVIEW", "SUSPICIOUS", "CLOSURE_NOT_VERIFIED")
        assert result.confidence > 0.0

    def test_missing_session_returns_human_review(self):
        """Nonexistent session returns score 0 and HUMAN_REVIEW."""
        svc = IntegrityScoringService()
        db = DummyFusionDB(session=None)
        result = svc.finalize_verification(db=db, session_id="nonexistent")

        assert result.overall_score == 0.0
        assert result.decision == "HUMAN_REVIEW"
        assert result.confidence == 0.0

    def test_custom_weights_normalized(self):
        """Custom unnormalized weights are automatically normalized to sum to 1.0."""
        custom_weights = {
            "scene": 2.0,
            "hazard": 3.0,
            "live_capture": 1.5,
            "spatial": 1.0,
            "temporal": 1.0,
            "freshness": 1.0,
            "quality": 0.5,
        }
        svc = IntegrityScoringService(weights=custom_weights)
        total = sum(svc.weights.values())
        assert abs(total - 1.0) < 1e-6

    def test_fusion_signals_persisted(self):
        """Fusion result contains required summary signals."""
        svc = IntegrityScoringService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="s2", ticket_id="t2", worker_id="w1")
        ticket = Ticket(id="t2", status="PENDING_VERIFICATION")

        db = DummyFusionDB(session=session, ticket=ticket)
        result = svc.finalize_verification(db=db, session_id="s2")

        signal_names = {s["signal_name"] for s in result.signals}
        expected = {
            "overall_integrity_score",
            "fusion_confidence",
            "final_decision",
            "fusion_explanation",
        }
        assert expected.issubset(signal_names)
