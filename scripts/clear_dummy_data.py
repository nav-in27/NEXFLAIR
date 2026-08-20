"""
MEIKAAN Database Dummy Data Cleaner
====================================
Clears all dummy/sample complaints, evidence records, verification sessions,
disputes, review actions, and audit logs from the MEIKAAN database.

Preserves core system accounts (Admin, Field Worker, Reviewer) and Wards.
"""

import os
import sys

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal, engine
from app.models.entities import (
    CitizenDispute, VerificationSignal, VerificationResult, VerificationSession,
    TicketEvidence, ReviewAction, AuditLog, WorkerActivity, Ticket
)

def clear_dummy_data():
    db = SessionLocal()
    try:
        print("[INFO] Clearing dummy data from database...")

        # 1. Clear dependent records first to honor foreign key constraints
        disputes_deleted = db.query(CitizenDispute).delete()
        signals_deleted = db.query(VerificationSignal).delete()
        results_deleted = db.query(VerificationResult).delete()
        sessions_deleted = db.query(VerificationSession).delete()
        evidence_deleted = db.query(TicketEvidence).delete()
        reviews_deleted = db.query(ReviewAction).delete()
        audit_deleted = db.query(AuditLog).delete()
        activity_deleted = db.query(WorkerActivity).delete()

        # 2. Clear all tickets
        tickets_deleted = db.query(Ticket).delete()

        db.commit()

        # 3. Clean uploaded files
        uploads_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend", "uploads"))
        if os.path.exists(uploads_dir):
            for root, dirs, files in os.walk(uploads_dir):
                for f in files:
                    if f.startswith("demo_") or f.endswith(".jpg") or f.endswith(".png"):
                        try:
                            os.remove(os.path.join(root, f))
                        except Exception:
                            pass

        print(f"[SUCCESS] Database cleaned successfully:")
        print(f"  - Tickets removed: {tickets_deleted}")
        print(f"  - Citizen Disputes removed: {disputes_deleted}")
        print(f"  - Evidence records removed: {evidence_deleted}")
        print(f"  - Verification sessions removed: {sessions_deleted}")
        print(f"  - Verification results removed: {results_deleted}")
        print(f"  - Verification signals removed: {signals_deleted}")
        print(f"  - Review actions removed: {reviews_deleted}")
        print(f"  - Audit logs removed: {audit_deleted}")
        print(f"  - Worker activities removed: {activity_deleted}")
        print("[INFO] System User Accounts (Admin, Worker, Reviewer) and Wards have been preserved.")
    except Exception as e:
        db.rollback()
        print(f"[ERROR] Failed to clear database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_dummy_data()
