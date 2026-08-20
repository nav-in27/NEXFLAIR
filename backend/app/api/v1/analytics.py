"""
MEIKAAN Analytics & Admin Dashboard API
========================================
Provides real-time aggregated metrics, ward suspicious rates, worker verification risk indicators,
and audit logs derived from live database records.

Wording Rule:
- Workers table is explicitly titled "Verification Risk Indicators" (NOT "Worker Fraud Ranking").
"""

import datetime
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func

from app.db.session import get_db
from app.models.entities import (
    Ticket, Worker, Ward, User, UserRole, TicketStatus,
    VerificationSession, VerificationResult, VerificationSignal, AuditLog
)
from app.api.deps import get_current_user, require_role

router = APIRouter()


@router.get("/dashboard")
async def get_dashboard_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Returns real-time aggregated dashboard metrics directly computed from live database records.
    """
    # 1. Total count & status breakdown
    total_tickets = db.query(Ticket).count()
    pending_verification = db.query(Ticket).filter(Ticket.status == TicketStatus.PENDING_VERIFICATION.value).count()
    verified = db.query(Ticket).filter(Ticket.status == TicketStatus.VERIFIED.value).count()
    human_review = db.query(Ticket).filter(Ticket.status == TicketStatus.HUMAN_REVIEW.value).count()
    suspicious = db.query(Ticket).filter(Ticket.status == TicketStatus.SUSPICIOUS.value).count()
    closed = db.query(Ticket).filter(Ticket.status == TicketStatus.CLOSED.value).count()

    # 2. Average Integrity Score across all evaluated verification results
    avg_score_res = db.query(func.avg(VerificationResult.integrity_score)).scalar()
    average_integrity_score = round(float(avg_score_res), 1) if avg_score_res is not None else 85.0

    # 3. Status distribution dict
    verification_distribution = {
        "OPEN": db.query(Ticket).filter(Ticket.status == TicketStatus.OPEN.value).count(),
        "ASSIGNED": db.query(Ticket).filter(Ticket.status == TicketStatus.ASSIGNED.value).count(),
        "IN_PROGRESS": db.query(Ticket).filter(Ticket.status == TicketStatus.IN_PROGRESS.value).count(),
        "PENDING_VERIFICATION": pending_verification,
        "VERIFIED": verified,
        "HUMAN_REVIEW": human_review,
        "SUSPICIOUS": suspicious,
        "CLOSED": closed,
    }

    # 4. Ward-level suspicious rate summary
    wards = db.query(Ward).all()
    ward_suspicious_rates = []
    for w in wards:
        w_total = db.query(Ticket).filter(Ticket.ward_id == w.id).count()
        w_susp = db.query(Ticket).filter(Ticket.ward_id == w.id, Ticket.status == TicketStatus.SUSPICIOUS.value).count()
        rate = round((w_susp / w_total * 100.0), 1) if w_total > 0 else 0.0
        ward_suspicious_rates.append({
            "ward_name": w.name,
            "total_tickets": w_total,
            "suspicious_tickets": w_susp,
            "suspicious_rate_pct": rate
        })

    # 5. Suspicious closure trend (last 7 days breakdown)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    suspicious_trend = []
    for i in range(6, -1, -1):
        day_date = today - datetime.timedelta(days=i)
        day_start = datetime.datetime.combine(day_date, datetime.time.min, tzinfo=datetime.timezone.utc)
        day_end = datetime.datetime.combine(day_date, datetime.time.max, tzinfo=datetime.timezone.utc)

        count = db.query(Ticket).filter(
            Ticket.status == TicketStatus.SUSPICIOUS.value,
            Ticket.updated_at >= day_start,
            Ticket.updated_at <= day_end
        ).count()

        suspicious_trend.append({
            "date": day_date.isoformat(),
            "suspicious_count": count
        })

    return {
        "total_tickets": total_tickets,
        "pending_verification": pending_verification,
        "verified": verified,
        "human_review": human_review,
        "suspicious": suspicious,
        "closed": closed,
        "average_integrity_score": average_integrity_score,
        "verification_distribution": verification_distribution,
        "ward_suspicious_rates": ward_suspicious_rates,
        "suspicious_closure_trend": suspicious_trend
    }


@router.get("/wards")
async def get_ward_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Returns live database metrics aggregated by Ward:
    Ward | Tickets | Verified | Review | Suspicious | Suspicious %
    """
    wards = db.query(Ward).order_by(Ward.ward_number.asc()).all()
    results = []

    for w in wards:
        w_tickets = db.query(Ticket).filter(Ticket.ward_id == w.id).all()
        t_count = len(w_tickets)
        ver_count = sum(1 for t in w_tickets if t.status in (TicketStatus.VERIFIED.value, TicketStatus.CLOSED.value))
        rev_count = sum(1 for t in w_tickets if t.status == TicketStatus.HUMAN_REVIEW.value)
        susp_count = sum(1 for t in w_tickets if t.status == TicketStatus.SUSPICIOUS.value)

        susp_pct = round((susp_count / t_count * 100.0), 1) if t_count > 0 else 0.0

        results.append({
            "ward_id": w.id,
            "ward_number": w.ward_number,
            "ward_name": w.name,
            "zone": w.zone,
            "total_tickets": t_count,
            "verified": ver_count,
            "human_review": rev_count,
            "suspicious": susp_count,
            "suspicious_percentage": susp_pct
        })

    return results


@router.get("/workers")
async def get_worker_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Returns live database metrics aggregated by Field Worker:
    Titled: "Verification Risk Indicators" (NOT "Worker Fraud Ranking").
    Worker | Tickets | Verified | Review | Suspicious | Average Integrity Score | Evidence Reuse Flags | Temporal Anomalies
    """
    workers = db.query(Worker).options(joinedload(Worker.user)).all()
    results = []

    for wk in workers:
        w_tickets = db.query(Ticket).filter(Ticket.assigned_worker_id == wk.id).all()
        t_count = len(w_tickets)
        ver_count = sum(1 for t in w_tickets if t.status in (TicketStatus.VERIFIED.value, TicketStatus.CLOSED.value))
        rev_count = sum(1 for t in w_tickets if t.status == TicketStatus.HUMAN_REVIEW.value)
        susp_count = sum(1 for t in w_tickets if t.status == TicketStatus.SUSPICIOUS.value)

        # Calculate average integrity score for worker's verification sessions
        sessions = (
            db.query(VerificationSession)
            .filter(VerificationSession.worker_id == wk.id)
            .all()
        )
        session_ids = [s.id for s in sessions]

        if session_ids:
            scores = (
                db.query(VerificationResult.integrity_score)
                .filter(VerificationResult.session_id.in_(session_ids))
                .all()
            )
            score_vals = [s[0] for s in scores if s[0] is not None]
            avg_score = round(sum(score_vals) / len(score_vals), 1) if score_vals else 85.0

            # Count evidence reuse signals
            v_results = db.query(VerificationResult.id).filter(VerificationResult.session_id.in_(session_ids)).all()
            vr_ids = [v[0] for v in v_results]

            reuse_flags = (
                db.query(VerificationSignal)
                .filter(
                    VerificationSignal.result_id.in_(vr_ids),
                    VerificationSignal.signal_name.in_(["is_exact_duplicate", "is_near_duplicate", "evidence_reuse_detected"]),
                    VerificationSignal.signal_value == "True"
                )
                .count()
            )

            # Count temporal anomalies
            temporal_anomalies = (
                db.query(VerificationSignal)
                .filter(
                    VerificationSignal.result_id.in_(vr_ids),
                    VerificationSignal.signal_name == "is_spatio_temporal_anomaly",
                    VerificationSignal.signal_value == "True"
                )
                .count()
            )
        else:
            avg_score = 100.0 if t_count == 0 else 85.0
            reuse_flags = 0
            temporal_anomalies = 0

        results.append({
            "worker_id": wk.id,
            "worker_code": wk.worker_code,
            "worker_name": wk.user.full_name if wk.user else "Unknown Worker",
            "email": wk.user.email if wk.user else "",
            "total_tickets": t_count,
            "verified": ver_count,
            "human_review": rev_count,
            "suspicious": susp_count,
            "average_integrity_score": avg_score,
            "evidence_reuse_flags": reuse_flags,
            "temporal_anomalies": temporal_anomalies
        })

    return results


@router.get("/audit")
async def get_audit_logs(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))
):
    """
    Returns system audit logs.
    """
    logs = (
        db.query(AuditLog)
        .options(joinedload(AuditLog.user))
        .order_by(AuditLog.timestamp.desc())
        .limit(100)
        .all()
    )

    results = []
    for log in logs:
        results.append({
            "id": log.id,
            "user_id": log.user_id,
            "user_email": log.user.email if log.user else "System",
            "user_name": log.user.full_name if log.user else "System",
            "action": log.action,
            "resource": log.resource,
            "details": log.details,
            "timestamp": log.timestamp.isoformat() if log.timestamp else ""
        })

    return results
