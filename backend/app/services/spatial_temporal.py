"""
MEIKAAN Spatial and Temporal Consistency Engine
===============================================
Evaluates spatial proximity between complaint coordinates, verification evidence,
and worker activity logs using Haversine distance calculations.

Evaluates spatio-temporal velocity across consecutive worker tasks to identify
physically unlikely travel speeds (Spatio-Temporal Anomalies).

IMPORTANT:
- GPS is NOT treated as absolute ground truth.
- Language constraints enforced:
  - Use: "Spatio-temporal inconsistency detected"
  - Do NOT use: "GPS spoofing detected"
- Missing/poor GPS or timestamp data yields LOW_CONFIDENCE, not automatically SUSPICIOUS.
"""

import math
import time
import logging
import datetime
from dataclasses import dataclass, field
from typing import Optional, List, Tuple
from sqlalchemy.orm import Session

from app.models.entities import Ticket, TicketEvidence, VerificationSession, Worker

logger = logging.getLogger("meikaan.spatial_temporal")


def haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates great-circle distance between two GPS coordinates in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(max(0.0, 1.0 - a)))
    return float(R * c)


@dataclass
class SpatialTemporalResult:
    """Immutable result from Spatial and Temporal Consistency Analysis."""
    spatial_score: float = 100.0
    distance_meters: Optional[float] = None
    location_status: str = "UNAVAILABLE"  # PASS, UNCERTAIN, FAIL, UNAVAILABLE
    observed_speed_kmh: Optional[float] = None
    is_spatio_temporal_anomaly: bool = False
    low_confidence: bool = False
    confidence: float = 1.0
    explanation: str = "Spatial and temporal coordinates are consistent."
    inference_time_ms: float = 0.0
    signals: List[dict] = field(default_factory=list)


# Configurable GPS location tolerance thresholds (in meters)
LOCATION_THRESHOLDS = {
    "STAGNANT_WATER": {"pass_m": 50.0, "fail_m": 200.0},
    "DEFAULT": {"pass_m": 100.0, "fail_m": 500.0},
}


class TemporalConsistencyService:
    """
    Service for evaluating Spatial Proximity and Spatio-Temporal Velocity Anomalies.
    """

    def analyze(
        self,
        db: Session,
        session_id: str,
    ) -> SpatialTemporalResult:
        """
        Executes Spatial and Temporal Consistency Analysis for a verification session.
        """
        t0 = time.perf_counter()

        session = db.query(VerificationSession).filter(VerificationSession.id == session_id).first()
        if not session:
            return SpatialTemporalResult(
                spatial_score=0.0,
                location_status="UNAVAILABLE",
                low_confidence=True,
                confidence=0.0,
                explanation="Verification session not found.",
            )

        ticket = db.query(Ticket).filter(Ticket.id == session.ticket_id).first()
        
        # Locate verification evidence submitted for session
        evidence = (
            db.query(TicketEvidence)
            .filter(
                TicketEvidence.ticket_id == session.ticket_id,
                TicketEvidence.verification_session_id == session.id,
            )
            .first()
        )
        if not evidence and session.evidence_id:
            evidence = db.query(TicketEvidence).filter(TicketEvidence.id == session.evidence_id).first()

        # Determine threshold rules by complaint type
        complaint_type = ticket.complaint_type if ticket and ticket.complaint_type else "STAGNANT_WATER"
        thresholds = LOCATION_THRESHOLDS.get(complaint_type, LOCATION_THRESHOLDS["DEFAULT"])
        pass_m = thresholds["pass_m"]
        fail_m = thresholds["fail_m"]

        # -------------------------------------------------------------------
        # 1. SPATIAL ANALYSIS (Ticket Complaint GPS vs Evidence GPS)
        # -------------------------------------------------------------------
        t_lat = ticket.latitude if ticket else None
        t_lon = ticket.longitude if ticket else None
        e_lat = evidence.latitude if evidence else None
        e_lon = evidence.longitude if evidence else None

        low_confidence = False
        spatial_score = 100.0
        dist_m = None
        location_status = "UNAVAILABLE"
        spatial_explanations = []

        if t_lat is None or t_lon is None or e_lat is None or e_lon is None:
            low_confidence = True
            spatial_score = 0.0
            confidence = 0.30
            location_status = "UNAVAILABLE"
            spatial_explanations.append("GPS_STATUS = UNAVAILABLE: Missing GPS coordinates for complaint or verification evidence.")
        else:
            # ------- GPS ACCURACY GATE -------
            # If either reading has extremely poor accuracy (>1000m), the GPS
            # cannot be used for street-level verification.
            GPS_ACCURACY_UNUSABLE_THRESHOLD = 1000.0  # meters

            ticket_accuracy = getattr(ticket, 'accuracy_meters', None)
            evidence_accuracy = getattr(evidence, 'accuracy_meters', None)

            gps_unusable = False
            accuracy_reasons = []
            if ticket_accuracy is not None and ticket_accuracy > GPS_ACCURACY_UNUSABLE_THRESHOLD:
                gps_unusable = True
                accuracy_reasons.append(f"Citizen GPS accuracy ±{ticket_accuracy:.0f}m exceeds {GPS_ACCURACY_UNUSABLE_THRESHOLD:.0f}m threshold")
            if evidence_accuracy is not None and evidence_accuracy > GPS_ACCURACY_UNUSABLE_THRESHOLD:
                gps_unusable = True
                accuracy_reasons.append(f"Worker evidence GPS accuracy ±{evidence_accuracy:.0f}m exceeds {GPS_ACCURACY_UNUSABLE_THRESHOLD:.0f}m threshold")

            dist_m = round(haversine_distance_meters(t_lat, t_lon, e_lat, e_lon), 1)

            if gps_unusable:
                # GPS is present but UNUSABLE for verification
                location_status = "UNUSABLE"
                spatial_score = 100.0  # Do not penalize overall score due to unusable GPS
                low_confidence = True
                confidence = 0.20
                spatial_explanations.append(
                    f"LOCATION SIGNAL UNRELIABLE: {'; '.join(accuracy_reasons)}. "
                    f"Raw distance: {dist_m}m (not used for verification)."
                )
            elif dist_m <= pass_m:
                location_status = "PASS"
                spatial_score = 100.0
                confidence = 0.95
                spatial_explanations.append(f"High spatial consistency: Evidence captured within {dist_m}m of complaint location.")
            elif dist_m <= fail_m:
                location_status = "UNCERTAIN"
                spatial_score = round(max(20.0, 100.0 - ((dist_m - pass_m) / (fail_m - pass_m)) * 80.0), 1)
                confidence = 0.80
                spatial_explanations.append(f"Location UNCERTAIN: Evidence captured {dist_m}m from complaint location (tolerance {pass_m}-{fail_m}m).")
            else:
                location_status = "FAIL"
                spatial_score = 0.0
                confidence = 0.95
                spatial_explanations.append(f"LOCATION MISMATCH FAIL: Evidence location is {dist_m}m away from complaint coordinates (exceeds {fail_m}m limit).")

        # -------------------------------------------------------------------
        # 2. TEMPORAL / VELOCITY ANOMALY ANALYSIS
        # -------------------------------------------------------------------
        is_anomaly = False
        observed_speed_kmh = None

        if session.worker_id and evidence and e_lat is not None and e_lon is not None:
            # Query recent prior evidence submitted by the same worker
            prior_evidences = (
                db.query(TicketEvidence)
                .join(VerificationSession, TicketEvidence.verification_session_id == VerificationSession.id)
                .filter(
                    VerificationSession.worker_id == session.worker_id,
                    TicketEvidence.id != evidence.id,
                    TicketEvidence.latitude.isnot(None),
                    TicketEvidence.longitude.isnot(None),
                )
                .order_by(TicketEvidence.captured_at.desc(), TicketEvidence.uploaded_at.desc())
                .limit(5)
                .all()
            )

            current_time = evidence.captured_at or evidence.uploaded_at or session.started_at

            for prior in prior_evidences:
                prior_time = prior.captured_at or prior.uploaded_at
                if not prior_time or not current_time:
                    continue

                # Calculate time delta in seconds
                dt_sec = abs((current_time - prior_time).total_seconds())
                if dt_sec <= 0:
                    dt_sec = 1.0  # Prevent divide-by-zero

                # Calculate distance between consecutive verification tasks
                task_dist_m = haversine_distance_meters(
                    float(prior.latitude), float(prior.longitude), float(e_lat), float(e_lon)
                )

                # Speed = distance / time
                speed_mps = task_dist_m / dt_sec
                speed_kmh = round(speed_mps * 3.6, 1)

                # If distance > 500m and travel speed > 120 km/h (unlikely urban speed cap)
                if task_dist_m > 500.0 and speed_kmh > 120.0 and dt_sec < 1800:
                    is_anomaly = True
                    observed_speed_kmh = speed_kmh
                    spatial_score = 0.0
                    location_status = "FAIL"
                    spatial_explanations.append(
                        f"Spatio-temporal inconsistency detected: Consecutive tasks imply physically unlikely travel speed of {speed_kmh} km/h over {round(task_dist_m)}m in {round(dt_sec)}s."
                    )
                    break

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)
        final_explanation = " | ".join(spatial_explanations) if spatial_explanations else "Spatial and temporal coordinates are consistent."

        # Build signals
        signals = [
            {"signal_name": "spatial_score", "signal_value": str(spatial_score), "confidence": confidence},
            {"signal_name": "location_status", "signal_value": location_status, "confidence": confidence},
            {"signal_name": "distance_meters", "signal_value": str(dist_m) if dist_m is not None else "N/A", "confidence": confidence},
            {"signal_name": "observed_speed_kmh", "signal_value": str(observed_speed_kmh) if observed_speed_kmh is not None else "N/A", "confidence": confidence},
            {"signal_name": "is_spatio_temporal_anomaly", "signal_value": str(is_anomaly), "confidence": confidence},
            {"signal_name": "low_confidence", "signal_value": str(low_confidence), "confidence": 1.0},
            {"signal_name": "spatial_temporal_explanation", "signal_value": final_explanation, "confidence": confidence},
            {"signal_name": "spatial_temporal_inference_time_ms", "signal_value": str(elapsed_ms), "confidence": 1.0},
        ]

        logger.info(
            "[SpatialTemporalEngine] Analysis complete | score=%.1f status=%s dist=%s anomaly=%s low_conf=%s ms=%.1f",
            spatial_score, location_status, dist_m, is_anomaly, low_confidence, elapsed_ms
        )

        return SpatialTemporalResult(
            spatial_score=spatial_score,
            distance_meters=dist_m,
            location_status=location_status,
            observed_speed_kmh=observed_speed_kmh,
            is_spatio_temporal_anomaly=is_anomaly,
            low_confidence=low_confidence,
            confidence=confidence,
            explanation=final_explanation,
            inference_time_ms=elapsed_ms,
            signals=signals,
        )


# Singleton instance
_spatial_temporal_service_instance: Optional[TemporalConsistencyService] = None


def get_temporal_consistency_service() -> TemporalConsistencyService:
    """Returns singleton TemporalConsistencyService instance."""
    global _spatial_temporal_service_instance
    if _spatial_temporal_service_instance is None:
        _spatial_temporal_service_instance = TemporalConsistencyService()
    return _spatial_temporal_service_instance

