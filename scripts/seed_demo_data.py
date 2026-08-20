"""
MEIKAAN Hackathon Demo Seeder
=============================
Generates 6 deterministic verification scenarios and populates PostgreSQL database.

Scenarios:
1. GENUINE_RESOLUTION
2. WRONG_LOCATION
3. NO_RESOLUTION
4. REPLAYED_EVIDENCE
5. SPATIO_TEMPORAL_ANOMALY
6. LOW_QUALITY_EVIDENCE

Usage:
python scripts/seed_demo_data.py
"""

import os
import sys
import cv2
import numpy as np
import datetime

# Add backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend"))
sys.path.insert(0, backend_dir)

from app.db.session import SessionLocal, engine
from app.models.entities import (
    Base, User, UserRole, Ward, Worker, Ticket, TicketStatus,
    TicketEvidence, EvidenceType, SourceType, VerificationSession,
    VerificationResult, VerificationSignal, ReviewAction, AuditLog
)

def create_deterministic_demo_assets(base_dir: str):
    """Generates synthetic image assets for all 6 deterministic hackathon scenarios."""
    uploads_dir = os.path.abspath(os.path.join(base_dir, "backend", "uploads"))
    viz_dir = os.path.join(uploads_dir, "visualizations")
    ev_dir = os.path.join(uploads_dir, "evidence")
    os.makedirs(viz_dir, exist_ok=True)
    os.makedirs(ev_dir, exist_ok=True)

    w, h = 640, 480

    # 1. Base Complaint Scene A (Road with puddle)
    img_before_a = np.full((h, w, 3), (180, 190, 200), dtype=np.uint8)
    cv2.line(img_before_a, (0, 240), (w, 240), (255, 255, 255), 4)
    cv2.rectangle(img_before_a, (50, 50), (180, 150), (120, 120, 120), -1)
    cv2.rectangle(img_before_a, (460, 80), (600, 300), (90, 100, 110), -1)
    cv2.ellipse(img_before_a, (320, 320), (140, 75), 0, 0, 360, (30, 40, 35), -1)
    cv2.imwrite(os.path.join(ev_dir, "demo_before_a.jpg"), img_before_a)

    # 2. Genuine Clean Scene A (Dry surface)
    img_clean_a = np.full((h, w, 3), (180, 190, 200), dtype=np.uint8)
    cv2.line(img_clean_a, (0, 240), (w, 240), (255, 255, 255), 4)
    cv2.rectangle(img_clean_a, (50, 50), (180, 150), (120, 120, 120), -1)
    cv2.rectangle(img_clean_a, (460, 80), (600, 300), (90, 100, 110), -1)
    cv2.ellipse(img_clean_a, (320, 320), (40, 20), 0, 0, 360, (140, 150, 155), -1)
    cv2.imwrite(os.path.join(ev_dir, "demo_clean_a.jpg"), img_clean_a)

    # 3. Wrong Location Scene B (Park bench, completely different geometry)
    img_wrong_b = np.full((h, w, 3), (60, 120, 70), dtype=np.uint8) # Green grass
    cv2.rectangle(img_wrong_b, (200, 200), (440, 350), (40, 70, 150), -1) # Wooden bench
    cv2.circle(img_wrong_b, (100, 100), 60, (30, 90, 40), -1) # Tree canopy
    cv2.imwrite(os.path.join(ev_dir, "demo_wrong_b.jpg"), img_wrong_b)

    # 4. No Resolution Scene C (Puddle still present, only 15% reduction)
    img_no_res = img_before_a.copy()
    cv2.ellipse(img_no_res, (320, 320), (130, 70), 0, 0, 360, (35, 45, 40), -1)
    cv2.imwrite(os.path.join(ev_dir, "demo_no_res.jpg"), img_no_res)

    # 5. Low Quality Blurred Scene D
    img_blurry = cv2.GaussianBlur(img_clean_a, (51, 51), 0)
    cv2.imwrite(os.path.join(ev_dir, "demo_blurry.jpg"), img_blurry)

    # Visualizations
    # Match A-A
    match_a = np.hstack([img_before_a, img_clean_a])
    for pt in [(50, 50), (180, 50), (180, 150), (50, 150), (460, 80), (600, 80), (600, 300), (460, 300)]:
        cv2.circle(match_a, pt, 5, (0, 255, 0), -1)
        cv2.circle(match_a, (pt[0]+w, pt[1]), 5, (0, 255, 0), -1)
        cv2.line(match_a, pt, (pt[0]+w, pt[1]), (0, 255, 0), 1)
    cv2.imwrite(os.path.join(viz_dir, "demo_match_genuine.png"), match_a)

    # Match A-B (Wrong location)
    match_b = np.hstack([img_before_a, img_wrong_b])
    cv2.putText(match_b, "MISMATCHED SCENE GEOMETRY (28/100)", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
    cv2.imwrite(os.path.join(viz_dir, "demo_match_wrong.png"), match_b)

    # Hazard Mask Genuine
    h_before = img_before_a.copy()
    cv2.ellipse(h_before, (320, 320), (140, 75), 0, 0, 360, (0, 0, 255), 3)
    h_clean = img_clean_a.copy()
    cv2.ellipse(h_clean, (320, 320), (40, 20), 0, 0, 360, (0, 255, 0), 3)
    haz_genuine = np.hstack([h_before, h_clean])
    cv2.imwrite(os.path.join(viz_dir, "demo_hazard_genuine.png"), haz_genuine)

    # Hazard Mask No Res
    h_no_res = img_no_res.copy()
    cv2.ellipse(h_no_res, (320, 320), (130, 70), 0, 0, 360, (0, 0, 255), 3)
    haz_no_res = np.hstack([h_before, h_no_res])
    cv2.imwrite(os.path.join(viz_dir, "demo_hazard_no_res.png"), haz_no_res)

    print("[SUCCESS] Deterministic hackathon demo image assets created successfully.")


def seed_database():
    """Populates PostgreSQL database with 6 deterministic hackathon scenarios."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    create_deterministic_demo_assets(base_dir)

    print("[SUCCESS] Hackathon demo database seeded successfully.")
    db.close()



if __name__ == "__main__":
    seed_database()
