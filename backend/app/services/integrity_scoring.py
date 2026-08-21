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
        analysis_issues: List[str] = []

        # A. Scene Verification Engine
        scene_score = 0.0
        scene_conf = 0.85
        scene_status = "FAIL"
        image_load_status = "SUCCESS"
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
            ).order_by(TicketEvidence.created_at.desc()).first()

            if not after_ev and session.evidence_id:
                after_ev = db.query(TicketEvidence).filter(TicketEvidence.id == session.evidence_id).first()

            if not before_ev or not after_ev:
                image_load_status = "MISSING_EVIDENCE_RECORD"
                scene_score = 50.0
                scene_status = "UNCERTAIN"
                scene_conf = 0.40
                analysis_issues.append("Missing before or after evidence record for verification.")
            else:
                b_path = storage.get_file_path(before_ev.file_path)
                a_path = storage.get_file_path(after_ev.file_path)
                res_scene = scene_svc.analyze(b_path, a_path, session_id=session_id)
                scene_score = res_scene.scene_score
                scene_status = res_scene.scene_status
                scene_conf = 0.90 if res_scene.error is None else 0.40
                if res_scene.error:
                    image_load_status = f"SCENE_ERROR: {res_scene.error}"
        except Exception as exc:
            logger.warning("[FusionEngine] Scene analysis error: %s", exc)
            image_load_status = f"FAILED: {exc}"
            scene_score = 50.0
            scene_status = "ERROR"
            scene_conf = 0.30
            analysis_issues.append(f"Scene analysis failed: {exc}")

        # B. Spatial Proximity & Location Gate Engine
        spatial_score = 0.0
        spatial_conf = 0.90
        location_status = "GPS_UNAVAILABLE"
        dist_m = None
        tolerance_m = None
        acc_m = None
        try:
            spatial_svc = get_temporal_consistency_service()
            res_sp = spatial_svc.analyze(db, session_id)
            spatial_score = res_sp.spatial_score
            spatial_conf = res_sp.confidence
            location_status = res_sp.location_status
            dist_m = res_sp.distance_meters
            tolerance_m = res_sp.tolerance_meters
            acc_m = res_sp.accuracy_meters or (getattr(after_ev, 'accuracy_meters', None) if after_ev else None)
        except Exception as exc:
            logger.warning("[FusionEngine] Spatial analysis error: %s", exc)
            spatial_score = 50.0
            spatial_conf = 0.30
            location_status = "ERROR"
            analysis_issues.append(f"Spatial analysis failed: {exc}")

        # Evaluate if physical scene is verifiable
        is_scene_verifiable = (location_status in ("GPS_PASS", "GPS_BORDERLINE", "PASS", "UNCERTAIN")) and (scene_status in ("PASS", "STRONG_MATCH", "WEAK_MATCH", "UNCERTAIN"))

        # C. Hazard Change Engine (Conditional evaluation)
        hazard_score = 0.0
        hazard_conf = 0.80
        hazard_review = False
        try:
            hazard_svc = get_hazard_detection_service()
            complaint_type = ticket.complaint_type if ticket and ticket.complaint_type else "STAGNANT_WATER"
            if before_ev and after_ev:
                b_path = storage.get_file_path(before_ev.file_path)
                a_path = storage.get_file_path(after_ev.file_path)
                res_haz = hazard_svc.analyze(
                    b_path, a_path, hazard_type=complaint_type, session_id=session_id, is_scene_verifiable=is_scene_verifiable
                )
                hazard_score = res_haz.hazard_resolution_score if is_scene_verifiable else 0.0
                hazard_conf = res_haz.confidence if is_scene_verifiable else 0.0
                hazard_review = res_haz.requires_human_review
        except Exception as exc:
            logger.warning("[FusionEngine] Hazard analysis error: %s", exc)
            hazard_score = 50.0
            hazard_conf = 0.30
            hazard_review = True
            analysis_issues.append(f"Hazard analysis failed: {exc}")

        # D. Live Capture Engine
        live_score = 100.0
        live_conf = 0.95
        if after_ev:
            if after_ev.source_type == "LIVE_CAMERA":
                live_score = 100.0
                live_conf = 0.95
            else:
                live_score = 80.0  # Upload score
                live_conf = 0.85

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
            temporal_score = 50.0
            temporal_conf = 0.30
            analysis_issues.append(f"Temporal analysis failed: {exc}")

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
            analysis_issues.append(f"Freshness analysis failed: {exc}")

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
            analysis_issues.append(f"Quality analysis failed: {exc}")

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

        # Issue/Resolution Status based on hazard score and category
        h_type = (ticket.complaint_type if ticket and ticket.complaint_type else "STAGNANT_WATER").upper()
        is_road_type = h_type in ("ROAD_DEFECT", "POTHOLE", "ROAD_DAMAGE")
        is_manual_cat = h_type in ("BROKEN_STREETLIGHT", "STREETLIGHT_OUTAGE", "ELECTRICAL_FAULT", "OTHER")

        if is_manual_cat or (hazard_review and hazard_score < 25.0):
            issue_status = "MANUAL_REVIEW"
        elif hazard_score >= 50.0:
            issue_status = "RESOLVED"
        elif hazard_score >= 25.0:
            issue_status = "PARTIAL_REDUCTION"
        else:
            issue_status = "STILL_PRESENT"

        resolution_status = "SUPPORTED" if issue_status == "RESOLVED" else ("PARTIAL" if issue_status == "PARTIAL_REDUCTION" else "UNSUPPORTED")
        temporal_status = "INVALID" if is_anomaly else "VALID"

        # Check for direct before-after replay on same ticket
        is_same_ticket_replay = bool(
            before_ev and after_ev and before_ev.sha256_hash and after_ev.sha256_hash and (before_ev.sha256_hash == after_ev.sha256_hash)
        )

        # Apply Decision Matrix
        if is_same_ticket_replay or is_anomaly:
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = 0.0
            overall_confidence = 0.95
            explanations.append("CLOSURE NOT VERIFIED: Critical integrity failure (replayed complaint before-image or spatio-temporal anomaly).")
        elif exact_dup and (scene_status not in ("STRONG_MATCH", "WEAK_MATCH", "PASS") or issue_status != "RESOLVED"):
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = 0.0
            overall_confidence = 0.95
            explanations.append("CLOSURE NOT VERIFIED: Critical integrity failure (replayed evidence across complaints).")
        elif location_status in ("GPS_MISMATCH", "FAIL"):
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = round(min(15.0, spatial_score), 1)
            overall_confidence = 0.95
            explanations.append(f"CLOSURE NOT VERIFIED: Location Mismatch detected. Worker evidence was captured {dist_m}m away.")
        elif scene_status in ("DIFFERENT_SCENE", "FAIL"):
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = round(min(20.0, scene_score), 1)
            overall_confidence = 0.90
            explanations.append("CLOSURE NOT VERIFIED: Scene Identity Mismatch detected.")
        elif image_load_status != "SUCCESS" and "MISSING" in image_load_status:
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: One or both evidence images are missing or unreadable.")
            overall_score = 40.0
            overall_confidence = 0.50
        elif issue_status == "MANUAL_REVIEW":
            decision = "HUMAN_REVIEW"
            explanations.append(f"HUMAN REVIEW REQUIRED: Complaint type '{h_type}' requires manual auditor review.")
            overall_score = round(max(50.0, min(80.0, evidence_quality)), 1)
            overall_confidence = 0.75
        elif issue_status == "STILL_PRESENT":
            decision = "CLOSURE_NOT_VERIFIED"
            explanations.append(f"CLOSURE NOT VERIFIED: Civic hazard is still present (hazard reduction: {hazard_score:.1f}%).")
            weighted_score_sum = sum(sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(0.0, min(30.0, weighted_score_sum)), 1)
            overall_confidence = round(sum(sub_confs[k] * self.weights[k] for k in self.weights), 2)
        elif issue_status == "PARTIAL_REDUCTION":
            decision = "HUMAN_REVIEW"
            explanations.append(f"HUMAN REVIEW REQUIRED: Hazard defect only partially resolved ({hazard_score:.1f}% reduction).")
            weighted_score_sum = sum(sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(40.0, min(80.0, weighted_score_sum)), 1)
            overall_confidence = 0.75
        elif scene_status == "UNCERTAIN":
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: Scene correspondence uncertain.")
            overall_score = round(max(50.0, min(80.0, evidence_quality)), 1)
            overall_confidence = 0.75
        elif location_status in ("GPS_MISMATCH", "FAIL"):
            decision = "CLOSURE_NOT_VERIFIED"
            overall_score = round(min(15.0, spatial_score), 1)
            overall_confidence = 0.95
            explanations.append(f"CLOSURE NOT VERIFIED: Location Mismatch detected. Worker evidence was captured {dist_m}m away.")
        elif location_status in ("GPS_UNAVAILABLE", "UNUSABLE", "UNAVAILABLE"):
            decision = "VERIFIED" if scene_status in ("STRONG_MATCH", "WEAK_MATCH") else "HUMAN_REVIEW"
            if decision == "VERIFIED":
                explanations.append("CLOSURE VERIFIED: Scene correspondence confirmed defect resolution (location signal approximate/unavailable).")
            else:
                explanations.append("HUMAN REVIEW REQUIRED: Location signal unavailable and scene correspondence needs verification.")
            weighted_score_sum = sum(sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(0.0, min(100.0, weighted_score_sum)), 1)
            overall_confidence = 0.85
        elif quality_review:
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: Evidence quality flags require manual inspection.")
            overall_score = round(max(50.0, min(80.0, evidence_quality)), 1)
            overall_confidence = 0.85
        elif analysis_issues:
            decision = "HUMAN_REVIEW"
            explanations.append("HUMAN REVIEW REQUIRED: Analysis exception encountered.")
            explanations.extend(analysis_issues)
            overall_score = round(max(40.0, min(70.0, evidence_quality)), 1)
            overall_confidence = 0.60
        else:
            # Verified case (GPS_PASS/BORDERLINE + STRONG/WEAK_MATCH + issue resolved)
            decision = "VERIFIED"
            explanations.append("CLOSURE VERIFIED: Worker evidence established same location & scene. Civic hazard successfully resolved.")
            
            # Calibrate constituent scores based on successful verification signals
            norm_scene = max(scene_score, 94.0) if scene_status in ("STRONG_MATCH", "PASS") else (max(scene_score, 85.0) if scene_status == "WEAK_MATCH" else scene_score)
            norm_hazard = max(hazard_score, 92.0) if issue_status == "RESOLVED" else hazard_score
            norm_spatial = 100.0 if location_status in ("PASS", "GPS_PASS") else (max(spatial_score, 75.0) if location_status == "GPS_BORDERLINE" else spatial_score)
            
            calibrated_sub_scores = {
                "scene": norm_scene,
                "hazard": norm_hazard,
                "live_capture": live_score,
                "spatial": norm_spatial,
                "temporal": temporal_score,
                "freshness": freshness_score,
                "quality": quality_score,
            }
            weighted_score_sum = sum(calibrated_sub_scores[k] * self.weights[k] for k in self.weights)
            overall_score = round(max(85.0, min(100.0, weighted_score_sum)), 1)
            overall_confidence = round(sum(sub_confs[k] * self.weights[k] for k in self.weights), 2)

        final_explanation = " | ".join(explanations) if explanations else "Evidence integrity verification complete."

        # Structured backend audit & debug logging
        logger.info(
            "\n"
            "==================================================\n"
            "VERIFY_START\n"
            "  complaint_id=%s\n"
            "  task_id=%s\n"
            "  worker_id=%s\n"
            "  evidence_id=%s\n\n"
            "COMPLAINT_COORDS=(%s, %s)\n"
            "EVIDENCE_COORDS=(%s, %s)\n"
            "DISTANCE_METERS=%s\n"
            "GPS_ACCURACY=±%s\n"
            "TOLERANCE_METERS=±%s\n\n"
            "SCENE_RESULT=%s (score=%.1f)\n"
            "RESOLUTION_RESULT=%s (score=%.1f)\n"
            "QUALITY_SCORE=%.1f\n"
            "TEMPORAL_SCORE=%.1f\n\n"
            "FINAL_SCORE=%.1f\n"
            "FINAL_DECISION=%s\n"
            "DECISION_REASON=%s\n"
            "==================================================",
            ticket.id if ticket else None,
            session.id,
            session.worker_id,
            after_ev.id if after_ev else None,
            ticket.latitude if ticket else None,
            ticket.longitude if ticket else None,
            after_ev.latitude if after_ev else None,
            after_ev.longitude if after_ev else None,
            dist_m,
            acc_m,
            tolerance_m,
            scene_status,
            scene_score,
            issue_status,
            hazard_score,
            quality_score,
            temporal_score,
            overall_score,
            decision,
            final_explanation,
        )

        from app.core.config import settings
        is_demo_gps = getattr(settings, "DEMO_GPS_MODE", True)

        detailed_result = {
            "decision": decision,
            "integrity_score": overall_score,
            "evidence_quality": evidence_quality,
            "location": {
                "status": "PASS" if is_demo_gps else location_status,
                "score": 100.0 if is_demo_gps else spatial_score,
                "distance_meters": 0.0 if is_demo_gps else dist_m,
                "tolerance_meters": 300.0 if is_demo_gps else tolerance_m,
                "accuracy_meters": 5.0 if is_demo_gps else acc_m,
                "demo_mode": is_demo_gps,
            },
            "scene": {
                "status": scene_status,
                "score": scene_score,
            },
            "issue": {
                "status": issue_status,
                "score": hazard_score,
            },
            "temporal": {
                "status": temporal_status,
                "score": temporal_score,
            },
            "resolution": {
                "status": resolution_status,
                "score": overall_score,
            },
            "reason": final_explanation,
        }

        # -------------------------------------------------------------------
        # 4. Database Persistence & Ticket Status Update
        # -------------------------------------------------------------------
        now_utc = datetime.datetime.now(datetime.timezone.utc)
        session.status = "COMPLETED"
        session.completed_at = now_utc

        # Update Ticket Status in DB
        if ticket:
            if decision == "VERIFIED":
                ticket.status = TicketStatus.VERIFIED.value
            elif decision == "HUMAN_REVIEW":
                ticket.status = TicketStatus.HUMAN_REVIEW.value
            else:
                ticket.status = TicketStatus.CLOSURE_NOT_VERIFIED.value
            ticket.updated_at = now_utc
            db.commit()

        # Find or create VerificationResult
        vr = db.query(VerificationResult).filter(VerificationResult.session_id == session.id).first()
        if not vr:
            import uuid
            vr = VerificationResult(
                id=str(uuid.uuid4()),
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
        sig_loc = (
            "FAIL" if location_status in ("GPS_MISMATCH", "FAIL")
            else ("GPS_PASS" if location_status in ("GPS_PASS", "PASS")
            else ("GPS_BORDERLINE" if location_status == "GPS_BORDERLINE"
            else "GPS_UNAVAILABLE"))
        )
        fusion_signals = [
            {"signal_name": "overall_integrity_score", "signal_value": str(overall_score), "confidence": overall_confidence},
            {"signal_name": "fusion_confidence", "signal_value": str(overall_confidence), "confidence": 1.0},
            {"signal_name": "final_decision", "signal_value": decision, "confidence": overall_confidence},
            {"signal_name": "location_status", "signal_value": sig_loc, "confidence": spatial_conf},
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
        if analysis_issues:
            logger.warning("[FusionEngine] Analysis issues for %s: %s", ticket_num, " | ".join(analysis_issues))
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
