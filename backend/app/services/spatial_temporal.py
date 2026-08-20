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
    tolerance_meters: Optional[float] = None
    accuracy_meters: Optional[float] = None
    location_status: str = "UNAVAILABLE"  # GPS_PASS, GPS_BORDERLINE, GPS_MISMATCH, GPS_UNAVAILABLE
    observed_speed_kmh: Optional[float] = None
    is_spatio_temporal_anomaly: bool = False
    low_confidence: bool = False
    confidence: float = 1.0
    explanation: str = "Spatial and temporal coordinates are consistent."
    inference_time_ms: float = 0.0
    signals: List[dict] = field(default_factory=list)


# Configurable GPS location tolerance thresholds (in meters)
LOCATION_THRESHOLDS = {
    "POTHOLE": {"pass_m": 35.0, "fail_m": 120.0},
    "ROAD_DEFECT": {"pass_m": 35.0, "fail_m": 120.0},
    "ROAD_DAMAGE": {"pass_m": 35.0, "fail_m": 120.0},
    "STAGNANT_WATER": {"pass_m": 35.0, "fail_m": 120.0},
    "GARBAGE": {"pass_m": 40.0, "fail_m": 150.0},
    "SOLID_WASTE": {"pass_m": 40.0, "fail_m": 150.0},
    "DEFAULT": {"pass_m": 40.0, "fail_m": 150.0},
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
        evidence = db.query(TicketEvidence).filter(
            TicketEvidence.verification_session_id == session.id
        ).order_by(TicketEvidence.created_at.desc()).first()

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
        location_status = "GPS_UNAVAILABLE"
        spatial_explanations = []

        if t_lat is None or t_lon is None or e_lat is None or e_lon is None:
            low_confidence = True
            spatial_score = 0.0
            confidence = 0.30
            location_status = "GPS_UNAVAILABLE"
            spatial_explanations.append("GPS_STATUS = GPS_UNAVAILABLE: Missing GPS coordinates for complaint or verification evidence.")
        else:
            ticket_accuracy = float(getattr(ticket, 'accuracy_meters', None) or 15.0)
            evidence_accuracy = float(getattr(evidence, 'accuracy_meters', None) or 15.0)

            dist_m = round(haversine_distance_meters(t_lat, t_lon, e_lat, e_lon), 1)

            # Combined accuracy tolerance allowance
            tolerance = max(pass_m, ticket_accuracy + evidence_accuracy)
            borderline_tolerance = tolerance + max(30.0, tolerance * 0.25)

            # If GPS accuracy is extraordinarily wide (> 10,000m):
            if ticket_accuracy > 10000.0 or evidence_accuracy > 10000.0:
                location_status = "GPS_UNAVAILABLE"
                spatial_score = 75.0
                low_confidence = True
                confidence = 0.40
                spatial_explanations.append(
                    f"LOCATION SIGNAL APPROXIMATE: Cellular/network accuracy ±{max(ticket_accuracy, evidence_accuracy):.0f}m. "
                    f"Raw distance: {dist_m}m. Relying on visual scene feature matching."
                )
            elif dist_m <= tolerance:
                location_status = "GPS_PASS"
                spatial_score = 100.0
                confidence = 0.95
                spatial_explanations.append(f"High spatial consistency: Evidence captured within {dist_m}m (tolerance ±{tolerance:.0f}m).")
            elif dist_m <= borderline_tolerance:
                location_status = "GPS_BORDERLINE"
                spatial_score = round(max(50.0, 100.0 - ((dist_m - tolerance) / max(1.0, borderline_tolerance - tolerance)) * 50.0), 1)
                confidence = 0.80
                spatial_explanations.append(f"Location GPS_BORDERLINE: Evidence captured {dist_m}m from complaint (tolerance ±{tolerance:.0f}m, borderline up to {borderline_tolerance:.0f}m).")
            else:
                location_status = "GPS_MISMATCH"
                spatial_score = 0.0
                confidence = 0.95
                spatial_explanations.append(f"LOCATION MISMATCH: Evidence location is {dist_m}m away from complaint coordinates (exceeds ±{borderline_tolerance:.0f}m limit).")

        # -------------------------------------------------------------------
        # 2. TEMPORAL / VELOCITY ANOMALY ANALYSIS
        # -------------------------------------------------------------------
        is_anomaly = False
        observed_speed_kmh = None

        if session.worker_id and evidence and e_lat is not None and e_lon is not None:
            def _to_utc_dt(val):
                if val is None:
                    return None
                if isinstance(val, str):
                    try:
                        val = datetime.datetime.fromisoformat(val.replace("Z", "+00:00"))
                    except Exception:
                        return None
                if isinstance(val, datetime.datetime) and val.tzinfo is None:
                    return val.replace(tzinfo=datetime.timezone.utc)
                return val

            curr_utc = _to_utc_dt(evidence.captured_at) or _to_utc_dt(evidence.uploaded_at) or _to_utc_dt(session.started_at) or datetime.datetime.now(datetime.timezone.utc)
            task_start_utc = _to_utc_dt(session.started_at) or curr_utc

            # Query recent prior verification evidence submitted by the same worker on DIFFERENT tickets completed before this task started
            prior_evidences = (
                db.query(TicketEvidence)
                .join(VerificationSession, TicketEvidence.verification_session_id == VerificationSession.id)
                .filter(
                    VerificationSession.worker_id == session.worker_id,
                    TicketEvidence.id != evidence.id,
                    TicketEvidence.evidence_type.in_(["AFTER", "LIVE_VERIFICATION"]),
                    TicketEvidence.ticket_id != session.ticket_id,
                    TicketEvidence.latitude.isnot(None),
                    TicketEvidence.longitude.isnot(None),
                    TicketEvidence.created_at < (session.started_at or curr_utc),
                )
                .order_by(TicketEvidence.created_at.desc())
                .limit(3)
                .all()
            )

            for prior in prior_evidences:
                prior_utc = _to_utc_dt(prior.uploaded_at) or _to_utc_dt(prior.captured_at) or _to_utc_dt(prior.created_at)
                if not prior_utc or not curr_utc:
                    continue

                # Transit elapsed time between previous task completion and current task start
                dt_sec = max(1.0, (task_start_utc - prior_utc).total_seconds())

                # Calculate distance between consecutive verification tasks
                task_dist_m = haversine_distance_meters(
                    float(prior.latitude), float(prior.longitude), float(e_lat), float(e_lon)
                )

                # Speed = distance / time (in km/h)
                speed_mps = task_dist_m / dt_sec
                speed_kmh = round(speed_mps * 3.6, 1)

                # If distance > 1,000m and travel speed > 150 km/h with a transit window under 1 hour
                if task_dist_m > 1000.0 and speed_kmh > 150.0 and dt_sec < 3600:
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
            tolerance_meters=tolerance if dist_m is not None else None,
            accuracy_meters=evidence_accuracy if dist_m is not None else None,
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

