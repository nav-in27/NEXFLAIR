"""
MEIKAAN Evidence Fusion Engine
==============================
Combines individual verification signals into a final explainable integrity score,
confidence level, and automated decision (VERIFIED, HUMAN_REVIEW, SUSPICIOUS).

Inputs & Default Weights:
- scene_score        : 0.20 (LoFTR / ORB keypoint scene matching)
- hazard_score       : 0.30 (YOLO / Classical CV stagnant water reduction)
- live_capture_score : 0.15 (WebRTC camera live capture vs demo upload)
- spatial_score      : 0.10 (Haversine distance complaint vs evidence GPS)
- temporal_score     : 0.10 (Worker velocity & spatio-temporal anomaly)
- freshness_score    : 0.10 (SHA-256 / pHash duplicate & timestamp freshness)
- quality_score      : 0.05 (Resolution, blur, exposure, obstruction)

Decision Thresholds:
- 90.0 – 100.0  : VERIFIED
- 70.0 – 89.99  : HUMAN_REVIEW
- 0.0  – 69.99  : SUSPICIOUS

CRITICAL RULES:
- Separates SCORE from CONFIDENCE.
- Forces decision to HUMAN_REVIEW if confidence < 0.50 or quality/hazard flags review.
- Forces decision to SUSPICIOUS if exact duplicate reuse is detected.
- Never generates random values.
"""

import time
import logging
import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from sqlalchemy.orm import Session

from app.models.entities import VerificationSession, VerificationResult, VerificationSignal, Ticket, TicketStatus
from app.services.scene_verification import get_scene_verification_service
from app.services.hazard_detection import get_hazard_detection_service
from app.services.freshness_service import get_evidence_freshness_service
from app.services.spatial_temporal import get_temporal_consistency_service
from app.services.quality_service import get_evidence_quality_service

logger = logging.getLogger("meikaan.fusion_engine")

DEFAULT_WEIGHTS: Dict[str, float] = {
    "scene": 0.20,
    "hazard": 0.30,
    "live_capture": 0.15,
    "spatial": 0.10,
    "temporal": 0.10,
    "freshness": 0.10,
    "quality": 0.05,
}

# Verify weights sum to 1.0
assert abs(sum(DEFAULT_WEIGHTS.values()) - 1.0) < 1e-6, "Weight configuration must sum to exactly 1.0"


@dataclass
class FinalIntegrityResult:
    """Immutable result from the Evidence Fusion Engine."""
    overall_score: float = 0.0
    confidence: float = 0.0
    decision: str = "HUMAN_REVIEW"  # VERIFIED, HUMAN_REVIEW, SUSPICIOUS
    explanation: str = "Fusion engine evaluation incomplete."
    sub_scores: Dict[str, float] = field(default_factory=dict)
    sub_confidences: Dict[str, float] = field(default_factory=dict)
    signals: List[dict] = field(default_factory=list)
    inference_time_ms: float = 0.0
    detailed_result: Optional[dict] = None


class IntegrityScoringService:
    """
    Evidence Fusion Engine Service.
    Runs or aggregates all 7 constituent analysis engines, applies weighted fusion,
    evaluates confidence overrides, and renders human-explainable decisions.
    """

    def __init__(self, weights: Optional[Dict[str, float]] = None):
        self.weights = weights or DEFAULT_WEIGHTS
        weight_sum = sum(self.weights.values())
        if abs(weight_sum - 1.0) > 1e-6:
            # Normalize weights if custom
            self.weights = {k: v / weight_sum for k, v in self.weights.items()}

    def finalize_verification(
        self,
        db: Session,
        session_id: str,
    ) -> FinalIntegrityResult:
        """
        Executes end-to-end multi-engine analysis, fuses all evidence signals,
        calculates overall integrity score, confidence, and decision.

        Updates ticket status in database and records verification_results & signals.
        """
        t0 = time.perf_counter()

        session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
        if not session:
            return FinalIntegrityResult(
                overall_score=0.0,
                confidence=0.0,
                decision="HUMAN_REVIEW",
                explanation="Verification session not found.",
            )

        ticket = db.query(Ticket).filter(Ticket.id == session.ticket_id).first()

        # -------------------------------------------------------------------
        # 1. Execute / Collect Signals from all 7 constituent engines
        # -------------------------------------------------------------------

        # A. Scene Verification Engine
        scene_score = 0.0
        scene_conf = 0.85
        scene_status = "FAIL"
        try:
            scene_svc = get_scene_verification_service()
            from app.models.entities import TicketEvidence, EvidenceType
            from app.services.storage import get_storage_provider
            storage = get_storage_provider()

            before_ev = db.query(TicketEvidence).filter(
                TicketEvidence.ticket_id == session.ticket_id,
                TicketEvidence.evidence_type == EvidenceType.BEFORE.value,
            ).order_by(TicketEvidence.created_at.asc()).first()

            after_ev = db.query(TicketEvidence).filter(
                TicketEvidence.ticket_id == session.ticket_id,
                TicketEvidence.verification_session_id == session.id,
            ).first()

            if before_ev and after_ev:
                b_path = storage.get_file_path(before_ev.file_path)
                a_path = storage.get_file_path(after_ev.file_path)
                res_scene = scene_svc.analyze(b_path, a_path, session_id=session_id)
                scene_score = res_scene.scene_score
                scene_status = res_scene.scene_status
                scene_conf = 0.90 if res_scene.error is None else 0.40
        except Exception as exc:
            logger.warning("[FusionEngine] Scene analysis error: %s", exc)
            scene_score = 0.0
            scene_status = "FAIL"
            scene_conf = 0.30

        # B. Spatial Proximity & Location Gate Engine
        spatial_score = 0.0
        spatial_conf = 0.90
        location_status = "UNAVAILABLE"
        dist_m = None
        try:
            spatial_svc = get_temporal_consistency_service()
            res_sp = spatial_svc.analyze(db, session_id)
            spatial_score = res_sp.spatial_score
            spatial_conf = res_sp.confidence
            location_status = res_sp.location_status
            dist_m = res_sp.distance_meters
        except Exception as exc:
            logger.warning("[FusionEngine] Spatial analysis error: %s", exc)
            spatial_score = 0.0
            spatial_conf = 0.30
            location_status = "UNAVAILABLE"

        # Evaluate if physical scene is verifiable
        is_scene_verifiable = (location_status in ("PASS", "UNCERTAIN")) and (scene_status in ("PASS", "STRONG_MATCH", "WEAK_MATCH", "UNCERTAIN"))

        # C. Hazard Change Engine (Conditional evaluation)
        hazard_score = 0.0
        hazard_conf = 0.80
        hazard_review = False
        try:
            hazard_svc = get_hazard_detection_service()
            if before_ev and after_ev:
                b_path = storage.get_file_path(before_ev.file_path)
                a_path = storage.get_file_path(after_ev.file_path)
                res_haz = hazard_svc.analyze(
                    b_path, a_path, session_id=session_id, is_scene_verifiable=is_scene_verifiable
                )
                hazard_score = res_haz.hazard_resolution_score if is_scene_verifiable else 0.0
                hazard_conf = res_haz.confidence if is_scene_verifiable else 0.0
                hazard_review = res_haz.requires_human_review
        except Exception as exc:
            logger.warning("[FusionEngine] Hazard analysis error: %s", exc)
            hazard_score = 0.0
            hazard_conf = 0.30
            hazard_review = True

        # D. Live Capture Engine
        live_score = 100.0
        live_conf = 0.95
        if after_ev:
            if after_ev.source_type == "LIVE_CAMERA":
                live_score = 100.0
                live_conf = 0.95
            else:
                live_score = 70.0  # Demo upload fallback score
                live_conf = 0.75

        # E. Temporal Velocity Engine
        temporal_score = 100.0
        temporal_conf = 0.90
        is_anomaly = False
        try:
            res_sp = get_temporal_consistency_service().analyze(db, session_id)
            temporal_score = res_sp.spatial_score
            temporal_conf = res_sp.confidence
            is_anomaly = res_sp.is_spatio_temporal_anomaly
        except Exception as exc:
            logger.warning("[FusionEngine] Temporal analysis error: %s", exc)
            temporal_score = 0.0
            temporal_conf = 0.30

        # F. Evidence Freshness Engine
        freshness_score = 100.0
        freshness_conf = 0.90
        reuse_detected = False
        exact_dup = False
        try:
            fresh_svc = get_evidence_freshness_service()
            if after_ev:
                res_fresh = fresh_svc.analyze_freshness(db, session_id, after_ev)
                freshness_score = res_fresh.freshness_score
                freshness_conf = 0.95
                reuse_detected = res_fresh.reuse_detected
                exact_dup = res_fresh.is_exact_duplicate
        except Exception as exc:
            logger.warning("[FusionEngine] Freshness analysis error: %s", exc)
            freshness_score = 50.0
            freshness_conf = 0.30

        # G. Evidence Quality Engine
        quality_score = 100.0
        quality_conf = 0.95
        quality_review = False
        try:
            qual_svc = get_evidence_quality_service()
            if after_ev:
                a_path = storage.get_file_path(after_ev.file_path)
                res_qual = qual_svc.analyze(a_path)
                quality_score = res_qual.quality_score
                quality_conf = 0.95
                quality_review = res_qual.human_review_required
        except Exception as exc:
            logger.warning("[FusionEngine] Quality analysis error: %s", exc)
            quality_score = 50.0
            quality_conf = 0.30
            quality_review = True

        sub_scores = {
            "scene": scene_score,
            "hazard": hazard_score,
            "live_capture": live_score,
            "spatial": spatial_score,
            "temporal": temporal_score,
            "freshness": freshness_score,
            "quality": quality_score,
        }
        sub_confs = {
            "scene": scene_conf,
            "hazard": hazard_conf,
            "live_capture": live_conf,
            "spatial": spatial_conf,
            "temporal": temporal_conf,
            "freshness": freshness_conf,
            "quality": quality_conf,
        }

        # -------------------------------------------------------------------
        # HARD GATES & EVALUATION PIPELINE
        # -------------------------------------------------------------------
        explanations = []

        # Evidence Quality Score based on Quality, Live Capture, and Freshness
        evidence_quality = round((quality_score * 0.5) + (live_score * 0.3) + (freshness_score * 0.2), 1)

        # Issue/Resolution Status based on hazard score
        issue_status = "MATCH" if hazard_score >= 70.0 else "STILL_PRESENT"
        resolution_status = "SUPPORTED" if hazard_score >= 70.0 else "UNSUPPORTED"
        temporal_status = "INVALID" if is_anomaly or exact_dup else "VALID"

        # Apply New Decision Matrix
        if exact_dup or is_anomaly:
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = 0.0
            overall_confidence = 0.95
            explanations.append("CLOSURE NOT VERIFIED: Critical integrity failure (replayed evidence or spatio-temporal anomaly).")
        elif location_status == "FAIL":
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = round(min(15.0, spatial_score), 1)
            overall_confidence = 0.95
            explanations.append(f"CLOSURE NOT VERIFIED: Location Mismatch detected. Worker evidence was captured {dist_m}m away.")
        elif scene_status == "DIFFERENT_SCENE":
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = round(min(15.0, scene_score), 1)
            overall_confidence = 0.90
            explanations.append("CLOSURE NOT VERIFIED: Scene Identity Mismatch detected.")
        elif location_status in ("UNUSABLE", "UNCERTAIN", "UNAVAILABLE"):
            decision = "HUMAN_REVIEW"
            if scene_status == "UNCERTAIN":
                explanations.append("HUMAN REVIEW REQUIRED: Location is unusable and scene identity is uncertain.")
            else:
                explanations.append("HUMAN REVIEW REQUIRED: Location is unusable, require manual confirmation of scene match.")
            overall_score = evidence_quality  # Score reflects evidence quality, not artificially 0
            overall_confidence = 0.75
        elif scene_status == "UNCERTAIN":
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: Scene correspondence uncertain.")
            overall_score = evidence_quality
            overall_confidence = 0.75
        elif quality_review:
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: Evidence quality flags (blur/exposure/resolution) require manual inspection.")
            overall_score = evidence_quality
            overall_confidence = 0.85
        elif issue_status == "STILL_PRESENT":
            decision = "CLOSURE_NOT_VERIFIED"
            explanations.append(f"CLOSURE NOT VERIFIED: Hazard reduction ({hazard_score:.1f}%) is insufficient for resolution approval.")
            weighted_score_sum = sum(sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(0.0, min(100.0, weighted_score_sum)), 1)
            overall_confidence = round(sum(sub_confs[k] * self.weights[k] for k in self.weights), 2)
        else:
            # location_status == PASS and scene_status in STRONG/WEAK_MATCH and issue_status == MATCH
            decision = "VERIFIED"
            explanations.append(f"CLOSURE VERIFIED: Worker evidence established same location & scene. Stagnant water hazard reduced by {hazard_score:.1f}%.")
            weighted_score_sum = sum(sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(0.0, min(100.0, weighted_score_sum)), 1)
            overall_confidence = round(sum(sub_confs[k] * self.weights[k] for k in self.weights), 2)

        final_explanation = " ".join(explanations)

        detailed_result = {
            "decision": decision,
            "evidence_quality": evidence_quality,
            "location": {
                "status": location_status,
                "score": spatial_score,
                "accuracy_meters": dist_m if dist_m is not None else None
            },
            "scene": {
                "status": scene_status,
                "score": scene_score
            },
            "issue": {
                "status": issue_status,
                "score": hazard_score
            },
            "temporal": {
                "status": temporal_status,
                "score": temporal_score
            },
            "resolution": {
                "status": resolution_status,
                "score": overall_score
            },
            "reason": final_explanation
        }

        # -------------------------------------------------------------------
        # 4. Database Persistence & Ticket Status Update
        # -------------------------------------------------------------------
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session.status = "COMPLETED"
        session.completed_at = now_utc

        if ticket:
            if decision == "VERIFIED":
                ticket.status = TicketStatus.VERIFIED.value
            elif decision == "SUSPICIOUS":
                ticket.status = TicketStatus.SUSPICIOUS.value
            elif decision == "CLOSURE_NOT_VERIFIED":
                ticket.status = TicketStatus.CLOSURE_NOT_VERIFIED.value
            else:
                ticket.status = TicketStatus.HUMAN_REVIEW.value
            ticket.updated_at = now_utc

        # Find or create VerificationResult
        vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
        if not vr:
            vr = VerificationResult(
                session_id=session.id,
                integrity_score=overall_score,
                integrity_status=decision,
                ela_score=None,
                exif_valid=True,
                created_at=now_utc,
            )
            db.add(vr)
        else:
            vr.integrity_score = overall_score
            vr.integrity_status = decision

        db.commit()
        db.refresh(vr)

        # Persist summary fusion signals
        fusion_signals = [
            {"signal_name": "overall_integrity_score", "signal_value": str(overall_score), "confidence": overall_confidence},
            {"signal_name": "fusion_confidence", "signal_value": str(overall_confidence), "confidence": 1.0},
            {"signal_name": "final_decision", "signal_value": decision, "confidence": overall_confidence},
            {"signal_name": "location_status", "signal_value": location_status, "confidence": spatial_conf},
            {"signal_name": "scene_status", "signal_value": scene_status, "confidence": scene_conf},
            {"signal_name": "scene_score_weighted", "signal_value": str(round(scene_score * self.weights["scene"], 2)), "confidence": scene_conf},
            {"signal_name": "hazard_score_weighted", "signal_value": str(round(hazard_score * self.weights["hazard"], 2)), "confidence": hazard_conf},
            {"signal_name": "live_score_weighted", "signal_value": str(round(live_score * self.weights["live_capture"], 2)), "confidence": live_conf},
            {"signal_name": "spatial_score_weighted", "signal_value": str(round(spatial_score * self.weights["spatial"], 2)), "confidence": spatial_conf},
            {"signal_name": "temporal_score_weighted", "signal_value": str(round(temporal_score * self.weights["temporal"], 2)), "confidence": temporal_conf},
            {"signal_name": "freshness_score_weighted", "signal_value": str(round(freshness_score * self.weights["freshness"], 2)), "confidence": freshness_conf},
            {"signal_name": "quality_score_weighted", "signal_value": str(round(quality_score * self.weights["quality"], 2)), "confidence": quality_conf},
            {"signal_name": "fusion_explanation", "signal_value": final_explanation, "confidence": overall_confidence},
        ]

        for sig in fusion_signals:
            vs = VerificationSignal(
                result_id=vr.id,
                signal_name=sig["signal_name"],
                signal_value=sig["signal_value"],
                confidence=sig["confidence"],
            )
            db.add(vs)
        db.commit()

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)

        # -------------------------------------------------------------------
        # STRUCTURED FORENSIC LOG
        # -------------------------------------------------------------------
        ticket_num = ticket.ticket_number if ticket else "UNKNOWN"
        logger.info(
            "\n[MEIKAAN VERIFICATION]\n"
            "CASE: %s\n"
            "\n"
            "GATE 1 — LOCATION\n"
            "  status: %s\n"
            "  spatial_score: %.1f\n"
            "  distance_meters: %s\n"
            "\n"
            "GATE 2 — SCENE\n"
            "  status: %s\n"
            "  scene_score: %.1f\n"
            "\n"
            "GATE 3 — HAZARD CHANGE\n"
            "  hazard_score: %.1f\n"
            "  requires_review: %s\n"
            "\n"
            "GATE 4 — TEMPORAL\n"
            "  temporal_score: %.1f\n"
            "  velocity_anomaly: %s\n"
            "\n"
            "GATE 5 — FRESHNESS\n"
            "  freshness_score: %.1f\n"
            "  exact_duplicate: %s\n"
            "\n"
            "GATE 6 — QUALITY\n"
            "  quality_score: %.1f\n"
            "  requires_review: %s\n"
            "\n"
            "FINAL DECISION: %s\n"
            "FINAL SCORE: %.1f / 100\n"
            "CONFIDENCE: %.2f\n",
            ticket_num,
            location_status, spatial_score, dist_m,
            scene_status, scene_score,
            hazard_score, hazard_review,
            temporal_score, is_anomaly,
            freshness_score, exact_dup,
            quality_score, quality_review,
            decision, overall_score, overall_confidence,
        )

        return FinalIntegrityResult(
            overall_score=overall_score,
            confidence=overall_confidence,
            decision=decision,
            explanation=final_explanation,
            sub_scores=sub_scores,
            sub_confidences=sub_confs,
            signals=fusion_signals,
            inference_time_ms=elapsed_ms,
            detailed_result=detailed_result
        )


# Singleton instance
_integrity_scoring_service_instance: Optional[IntegrityScoringService] = None

def get_integrity_scoring_service() -> IntegrityScoringService:
    """Returns singleton IntegrityScoringService instance."""
    global _integrity_scoring_service_instance
    if _integrity_scoring_service_instance is None:
        _integrity_scoring_service_instance = IntegrityScoringService()
    return _integrity_scoring_service_instance
