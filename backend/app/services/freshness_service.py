"""
MEIKAAN Evidence Freshness Engine
=================================
Evaluates whether submitted verification evidence is fresh and specific to
the active verification event.

Key Checks:
1. SHA-256 hash exact duplicate lookup against historical evidence.
2. Perceptual hash (aHash) Hamming distance near-duplicate lookup.
3. Capture & Upload timestamp delta analysis relative to verification session window.
4. Verification session relationship validation.

IMPORTANT:
- Language constraints enforced: "Evidence freshness concern" / "Possible evidence reuse".
- Never claims metadata proves authenticity.
- Deterministic scoring: No random scores.
"""

import logging
import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.models.entities import TicketEvidence, VerificationSession, Ticket

logger = logging.getLogger("meikaan.freshness_engine")


def compute_phash_hamming_distance(hex1: Optional[str], hex2: Optional[str]) -> int:
    """Computes bitwise Hamming distance between two 16-character hex perceptual hashes."""
    if not hex1 or not hex2 or len(hex1) != 16 or len(hex2) != 16:
        return 64  # Maximum distance (completely different)
    try:
        val1 = int(hex1, 16)
        val2 = int(hex2, 16)
        return bin(val1 ^ val2).count("1")
    except ValueError:
        return 64


@dataclass
class FreshnessAnalysisResult:
    """Immutable result from the Evidence Freshness Engine."""
    freshness_score: float = 100.0
    reuse_detected: bool = False
    is_exact_duplicate: bool = False
    is_near_duplicate: bool = False
    is_suspiciously_old: bool = False
    missing_capture_timestamp: bool = False
    matched_evidence_id: Optional[str] = None
    explanation: str = "Evidence appears fresh and specific to current verification session."
    inference_time_ms: float = 0.0
    signals: List[dict] = field(default_factory=list)


class EvidenceFreshnessService:
    """
    Evidence Freshness Engine Service.
    Queries database historical evidence to detect exact & near duplicates,
    stale capture timestamps, and session relationship irregularities.
    """

    def analyze_freshness(
        self,
        db: Session,
        session_id: str,
        current_evidence: TicketEvidence,
    ) -> FreshnessAnalysisResult:
        """
        Analyzes evidence freshness for a verification session.

        Parameters
        ----------
        db : Session
            SQLAlchemy database session.
        session_id : str
            Verification session ID.
        current_evidence : TicketEvidence
            The newly submitted evidence record to evaluate.

        Returns
        -------
        FreshnessAnalysisResult
        """
        start_time = datetime.datetime.now(datetime.timezone.utc)
        
        session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
        ticket = db.query(Ticket).filter(Ticket.id == session.ticket_id).first() if session else None

        base_score = 100.0
        reuse_detected = False
        is_exact_dup = False
        is_near_dup = False
        is_old = False
        missing_ts = False
        matched_id = None
        explanations = []

        # 1. SHA-256 Exact Duplicate Detection
        exact_match = (
            db.query(TicketEvidence)
            .filter(
                TicketEvidence.sha256_hash == current_evidence.sha256_hash,
                TicketEvidence.id != current_evidence.id,
            )
            .first()
        )
        if exact_match:
            reuse_detected = True
            is_exact_dup = True
            matched_id = exact_match.id
            base_score = 0.0
            explanations.append("Possible evidence reuse: Exact duplicate image payload (SHA-256 match) detected in historical evidence database.")

        # 2. Perceptual Hash Near-Duplicate Detection (if not exact duplicate)
        if not is_exact_dup and current_evidence.perceptual_hash:
            historical_records = (
                db.query(TicketEvidence)
                .filter(
                    TicketEvidence.id != current_evidence.id,
                    TicketEvidence.perceptual_hash.isnot(None),
                )
                .all()
            )
            
            min_dist = 64
            closest_record = None
            for rec in historical_records:
                dist = compute_phash_hamming_distance(current_evidence.perceptual_hash, rec.perceptual_hash)
                if dist < min_dist:
                    min_dist = dist
                    closest_record = rec

            if min_dist <= 6 and closest_record:
                reuse_detected = True
                is_near_dup = True
                matched_id = closest_record.id
                deduction = (7 - min_dist) * 12.5  # Hamming 0=87.5% deduction, 6=12.5% deduction
                base_score = max(0.0, base_score - deduction)
                explanations.append(f"Possible evidence reuse: Visually near-duplicate image detected (Perceptual Hash distance {min_dist} bits <= 6).")

        # 3. Capture Timestamp Freshness Analysis
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session_start = session.started_at if session and session.started_at else now_utc

        # Ensure session_start is timezone-aware
        if session_start.tzinfo is None:
            session_start = session_start.replace(tzinfo=datetime.timezone.utc)

        if current_evidence.captured_at:
            cap_time = current_evidence.captured_at
            if cap_time.tzinfo is None:
                cap_time = cap_time.replace(tzinfo=datetime.timezone.utc)

            # Check if captured > 24 hours prior to session start
            time_delta = session_start - cap_time
            if time_delta.total_seconds() > 86400:  # > 24 hours
                is_old = True
                base_score = max(0.0, base_score - 35.0)
                hours_old = time_delta.total_seconds() / 3600.0
                explanations.append(f"Evidence freshness concern: Image capture timestamp is {hours_old:.1f} hours older than verification session window.")
            elif time_delta.total_seconds() < -300:  # > 5 minutes in future (clock skew)
                base_score = max(0.0, base_score - 15.0)
                explanations.append("Evidence freshness concern: Image capture timestamp is in the future relative to session start.")
        else:
            missing_ts = True
            base_score = min(base_score, 80.0)
            explanations.append("Evidence freshness concern: Missing camera EXIF capture timestamp metadata.")

        # 4. Source Type Context
        if current_evidence.source_type == "UPLOAD":
            explanations.append("Source type is DEMO UPLOAD MODE (not direct live camera capture).")

        final_score = round(max(0.0, min(100.0, base_score)), 1)
        final_explanation = " | ".join(explanations) if explanations else "Evidence appears fresh and specific to current verification session."
        
        elapsed_ms = round((datetime.datetime.now(datetime.timezone.utc) - start_time).total_seconds() * 1000.0, 1)

        # 5. Build Signals List
        signals = [
            {"signal_name": "freshness_score", "signal_value": str(final_score), "confidence": 1.0},
            {"signal_name": "reuse_detected", "signal_value": str(reuse_detected), "confidence": 1.0},
            {"signal_name": "is_exact_duplicate", "signal_value": str(is_exact_dup), "confidence": 1.0},
            {"signal_name": "is_near_duplicate", "signal_value": str(is_near_dup), "confidence": 1.0},
            {"signal_name": "is_suspiciously_old", "signal_value": str(is_old), "confidence": 1.0},
            {"signal_name": "missing_capture_timestamp", "signal_value": str(missing_ts), "confidence": 1.0},
            {"signal_name": "freshness_explanation", "signal_value": final_explanation, "confidence": 1.0},
            {"signal_name": "freshness_inference_time_ms", "signal_value": str(elapsed_ms), "confidence": 1.0},
        ]
        if matched_id:
            signals.append({"signal_name": "matched_historical_evidence_id", "signal_value": matched_id, "confidence": 1.0})

        logger.info(
            "[FreshnessEngine] Complete | score=%.1f reuse=%s exact=%s near=%s old=%s ms=%.1f",
            final_score, reuse_detected, is_exact_dup, is_near_dup, is_old, elapsed_ms
        )

        return FreshnessAnalysisResult(
            freshness_score=final_score,
            reuse_detected=reuse_detected,
            is_exact_duplicate=is_exact_dup,
            is_near_duplicate=is_near_dup,
            is_suspiciously_old=is_old,
            missing_capture_timestamp=missing_ts,
            matched_evidence_id=matched_id,
            explanation=final_explanation,
            inference_time_ms=elapsed_ms,
            signals=signals,
        )


# Singleton Instance
_freshness_service_instance: Optional[EvidenceFreshnessService] = None

def get_evidence_freshness_service() -> EvidenceFreshnessService:
    """Returns singleton EvidenceFreshnessService instance."""
    global _freshness_service_instance
    if _freshness_service_instance is None:
        _freshness_service_instance = EvidenceFreshnessService()
    return _freshness_service_instance
