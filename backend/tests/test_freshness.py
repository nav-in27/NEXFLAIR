"""
Phase 8 – Evidence Freshness Engine Tests
=========================================
Tests the EvidenceFreshnessService:
- Fresh new image payload
- Exact duplicate (SHA-256 collision)
- Near duplicate (Perceptual Hash Hamming distance <= 6)
- Suspiciously old image (captured > 24h prior)
- Missing capture timestamp metadata
"""

import uuid
import datetime
import pytest
from app.models.entities import TicketEvidence, VerificationSession, Ticket, Worker, Ward
from app.services.freshness_service import (
    EvidenceFreshnessService,
    compute_phash_hamming_distance,
    FreshnessAnalysisResult,
)


class DummyDB:
    """Mock DB query interface for unit testing freshness logic."""
    def __init__(self, records=None, session=None):
        self._records = records or []
        self._session = session

    def query(self, model):
        self._target_model = model
        return self

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args):
        return self

    def first(self):
        if self._target_model == VerificationSession:
            return self._session
        if self._target_model == TicketEvidence:
            for r in self._records:
                if getattr(r, "_is_exact_match", False):
                    return r
            return None
        return None

    def all(self):
        if self._target_model == TicketEvidence:
            return [r for r in self._records if getattr(r, "_is_phash_match", False)]
        return []


# ──────────────────────────────────────────────────────────────────
# 1. Hamming Distance Helper Tests
# ──────────────────────────────────────────────────────────────────

def test_phash_hamming_distance_identical():
    """Identical 16-hex pHashes yield distance 0."""
    h = "a1b2c3d4e5f60718"
    assert compute_phash_hamming_distance(h, h) == 0


def test_phash_hamming_distance_one_bit_diff():
    """1-bit hex difference yields distance 1."""
    h1 = "0000000000000000"
    h2 = "0000000000000001"
    assert compute_phash_hamming_distance(h1, h2) == 1


def test_phash_hamming_distance_invalid():
    """Invalid hex strings return 64."""
    assert compute_phash_hamming_distance("invalid", "short") == 64
    assert compute_phash_hamming_distance(None, "0000000000000000") == 64


# ──────────────────────────────────────────────────────────────────
# 2. Freshness Engine Unit Tests
# ──────────────────────────────────────────────────────────────────

class TestEvidenceFreshnessService:

    def test_fresh_new_image(self):
        """Fresh image with no historical match -> score 100, reuse False."""
        svc = EvidenceFreshnessService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(
            id="sess-1",
            ticket_id="ticket-1",
            worker_id="worker-1",
            started_at=now - datetime.timedelta(minutes=5),
            expires_at=now + datetime.timedelta(minutes=10),
        )
        current_ev = TicketEvidence(
            id="ev-curr",
            ticket_id="ticket-1",
            sha256_hash="unique_hash_123",
            perceptual_hash="1111222233334444",
            captured_at=now - datetime.timedelta(minutes=4),
            uploaded_at=now - datetime.timedelta(minutes=2),
            source_type="LIVE_CAMERA",
        )

        db = DummyDB(records=[], session=session)
        result = svc.analyze_freshness(db=db, session_id="sess-1", current_evidence=current_ev)

        assert isinstance(result, FreshnessAnalysisResult)
        assert result.freshness_score == 100.0
        assert result.reuse_detected is False
        assert result.is_exact_duplicate is False
        assert result.is_near_duplicate is False
        assert result.is_suspiciously_old is False
        assert "fresh and specific" in result.explanation

    def test_exact_duplicate_detection(self):
        """Matching SHA-256 hash -> score 0.0, reuse True, explanation contains 'Possible evidence reuse'."""
        svc = EvidenceFreshnessService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-1", started_at=now)
        current_ev = TicketEvidence(
            id="ev-curr",
            sha256_hash="duplicate_sha256_hash",
            perceptual_hash="1111222233334444",
            captured_at=now,
            source_type="LIVE_CAMERA",
        )
        matched_ev = TicketEvidence(
            id="ev-old",
            sha256_hash="duplicate_sha256_hash",
            perceptual_hash="1111222233334444",
        )
        matched_ev._is_exact_match = True

        db = DummyDB(records=[matched_ev], session=session)
        result = svc.analyze_freshness(db=db, session_id="sess-1", current_evidence=current_ev)

        assert result.freshness_score == 0.0
        assert result.reuse_detected is True
        assert result.is_exact_duplicate is True
        assert result.matched_evidence_id == "ev-old"
        assert "Possible evidence reuse" in result.explanation

    def test_near_duplicate_detection(self):
        """Perceptual hash Hamming distance <= 6 -> score deduction, is_near_duplicate True."""
        svc = EvidenceFreshnessService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-1", started_at=now)
        current_ev = TicketEvidence(
            id="ev-curr",
            sha256_hash="unique_hash_999",
            perceptual_hash="0000000000000000",
            captured_at=now,
            source_type="LIVE_CAMERA",
        )
        # Near duplicate hash differing by only 2 bits
        near_ev = TicketEvidence(
            id="ev-near",
            sha256_hash="other_hash_888",
            perceptual_hash="0000000000000003",
        )
        near_ev._is_phash_match = True

        db = DummyDB(records=[near_ev], session=session)
        result = svc.analyze_freshness(db=db, session_id="sess-1", current_evidence=current_ev)

        assert result.reuse_detected is True
        assert result.is_near_duplicate is True
        assert result.freshness_score < 100.0
        assert "Possible evidence reuse" in result.explanation

    def test_suspiciously_old_evidence(self):
        """Image captured > 24h prior to session -> is_suspiciously_old True, score deduction."""
        svc = EvidenceFreshnessService()
        now = datetime.datetime.now(datetime.timezone.utc)
        session_start = now
        stale_capture = now - datetime.timedelta(hours=48)

        session = VerificationSession(id="sess-1", started_at=session_start)
        current_ev = TicketEvidence(
            id="ev-curr",
            sha256_hash="unique_hash_777",
            perceptual_hash="9999888877776666",
            captured_at=stale_capture,
            source_type="LIVE_CAMERA",
        )

        db = DummyDB(records=[], session=session)
        result = svc.analyze_freshness(db=db, session_id="sess-1", current_evidence=current_ev)

        assert result.is_suspiciously_old is True
        assert result.freshness_score <= 65.0
        assert "Evidence freshness concern" in result.explanation

    def test_missing_capture_timestamp_metadata(self):
        """No capture timestamp -> missing_capture_timestamp True, score capped at 80.0."""
        svc = EvidenceFreshnessService()
        now = datetime.datetime.now(datetime.timezone.utc)

        session = VerificationSession(id="sess-1", started_at=now)
        current_ev = TicketEvidence(
            id="ev-curr",
            sha256_hash="unique_hash_555",
            perceptual_hash="aaabbbcccdddeee1",
            captured_at=None,  # Missing EXIF capture time
            source_type="UPLOAD",
        )

        db = DummyDB(records=[], session=session)
        result = svc.analyze_freshness(db=db, session_id="sess-1", current_evidence=current_ev)

        assert result.missing_capture_timestamp is True
        assert result.freshness_score <= 80.0
        assert "Evidence freshness concern" in result.explanation
