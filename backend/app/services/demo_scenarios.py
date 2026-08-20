"""
MEIKAAN Deterministic Hackathon Demo Scenarios Service
=====================================================
Serves the 6 deterministic verification scenarios for hackathon presentation.
NO RANDOM SCORES. Uses prepared deterministic pipeline signals and explanations.
"""

from typing import Dict, List, Any


SCENARIOS: Dict[str, Dict[str, Any]] = {
    "GENUINE_RESOLUTION": {
        "scenario_id": "GENUINE_RESOLUTION",
        "title": "Scenario 1: Genuine Resolution",
        "subtitle": "Worker successfully cleared puddle, matched scene, live camera capture verified.",
        "ticket_number": "TKT-2026-4821",
        "ticket_code_display": "TKT #4821",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 14",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_clean_a.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_genuine.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_genuine.png",
        "scene_consistency": 96,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 800,
        "visual_reduction_pct": 93.6,
        "signals": {
            "scene": 96,
            "hazard": 94,
            "live_capture": 98,
            "spatial": 93,
            "temporal": 91,
            "freshness": 98,
            "quality": 95
        },
        "overall_score": 95,
        "confidence": 0.94,
        "decision": "VERIFIED",
        "explanation": "The submitted evidence is visually consistent with the original scene (96%) and shows genuine reduction of stagnant water area (93.6%)."
    },
    "WRONG_LOCATION": {
        "scenario_id": "WRONG_LOCATION",
        "title": "Scenario 2: Wrong Location",
        "subtitle": "Worker submitted photo from a different park scene, mismatched geometric keypoints.",
        "ticket_number": "TKT-2026-5012",
        "ticket_code_display": "TKT #5012",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 08",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_wrong_b.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_wrong.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_genuine.png",
        "scene_consistency": 8,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 0,
        "visual_reduction_pct": 0.0,
        "signals": {
            "scene": 8,
            "hazard": 0,
            "live_capture": 95,
            "spatial": 0,
            "temporal": 90,
            "freshness": 95,
            "quality": 92
        },
        "overall_score": 12,
        "confidence": 0.95,
        "decision": "CLOSURE_NOT_VERIFIED",
        "explanation": "CLOSURE NOT VERIFIED: Worker evidence does not correspond to the reported location or scene. Critical Location & Scene Identity Gate FAIL."
    },
    "NO_RESOLUTION": {
        "scenario_id": "NO_RESOLUTION",
        "title": "Scenario 3: No Resolution",
        "subtitle": "Worker visited correct location but puddle was not cleared (hazard area reduction only 15%).",
        "ticket_number": "TKT-2026-6140",
        "ticket_code_display": "TKT #6140",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 19",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_no_res.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_genuine.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_no_res.png",
        "scene_consistency": 92,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 10625,
        "visual_reduction_pct": 15.0,
        "signals": {
            "scene": 92,
            "hazard": 15,
            "live_capture": 96,
            "spatial": 92,
            "temporal": 89,
            "freshness": 96,
            "quality": 94
        },
        "overall_score": 58,
        "confidence": 0.89,
        "decision": "HUMAN_REVIEW",
        "explanation": "Visual scene is matching (92%), but stagnant water hazard area reduction is only 15.0%, below the configured 70.0% expected threshold."
    },
    "REPLAYED_EVIDENCE": {
        "scenario_id": "REPLAYED_EVIDENCE",
        "title": "Scenario 4: Replayed Evidence",
        "subtitle": "Worker submitted a previously used photo from another ticket. Exact SHA-256 hash match.",
        "ticket_number": "TKT-2026-7209",
        "ticket_code_display": "TKT #7209",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 03",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_clean_a.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_genuine.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_genuine.png",
        "scene_consistency": 95,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 800,
        "visual_reduction_pct": 93.6,
        "signals": {
            "scene": 95,
            "hazard": 92,
            "live_capture": 70,
            "spatial": 88,
            "temporal": 90,
            "freshness": 12,
            "quality": 95
        },
        "overall_score": 64,
        "confidence": 0.95,
        "decision": "SUSPICIOUS",
        "explanation": "CRITICAL: Exact duplicate evidence payload detected in database history. SHA-256 collision identified with Ticket TKT-2026-4821."
    },
    "SPATIO_TEMPORAL_ANOMALY": {
        "scenario_id": "SPATIO_TEMPORAL_ANOMALY",
        "title": "Scenario 5: Spatio-Temporal Anomaly",
        "subtitle": "Worker claimed verification 15km away only 2 minutes after last ticket (240 km/h velocity).",
        "ticket_number": "TKT-2026-8341",
        "ticket_code_display": "TKT #8341",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 22",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_clean_a.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_genuine.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_genuine.png",
        "scene_consistency": 91,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 800,
        "visual_reduction_pct": 93.6,
        "signals": {
            "scene": 91,
            "hazard": 88,
            "live_capture": 95,
            "spatial": 60,
            "temporal": 20,
            "freshness": 95,
            "quality": 94
        },
        "overall_score": 67,
        "confidence": 0.92,
        "decision": "SUSPICIOUS",
        "explanation": "Spatio-temporal inconsistency detected in consecutive worker tasks. Required travel velocity of 240.0 km/h exceeds human limits."
    },
    "LOW_QUALITY_EVIDENCE": {
        "scenario_id": "LOW_QUALITY_EVIDENCE",
        "title": "Scenario 6: Low Quality Evidence",
        "subtitle": "Blurry image submitted. Routed to Human Review without falsely accusing worker of fraud.",
        "ticket_number": "TKT-2026-9410",
        "ticket_code_display": "TKT #9410",
        "complaint_type": "STAGNANT WATER",
        "ward_name": "WARD 14",
        "before_image_url": "/uploads/evidence/demo_before_a.jpg",
        "verification_image_url": "/uploads/evidence/demo_blurry.jpg",
        "scene_viz_url": "/uploads/visualizations/demo_match_genuine.png",
        "hazard_viz_url": "/uploads/visualizations/demo_hazard_genuine.png",
        "scene_consistency": 45,
        "before_hazard_area_px": 12500,
        "after_hazard_area_px": 2100,
        "visual_reduction_pct": 83.2,
        "signals": {
            "scene": 45,
            "hazard": 70,
            "live_capture": 95,
            "spatial": 90,
            "temporal": 90,
            "freshness": 95,
            "quality": 35
        },
        "overall_score": 62,
        "confidence": 0.85,
        "decision": "HUMAN_REVIEW",
        "explanation": "HUMAN_REVIEW forced: Evidence quality flags (BLURRY / Laplacian variance 42.1) detected. Visual quality insufficient for automated engine approval."
    }
}


def get_all_scenarios() -> List[Dict[str, Any]]:
    """Returns list of all 6 deterministic scenarios."""
    return list(SCENARIOS.values())


def get_scenario_by_id(scenario_id: str) -> Dict[str, Any]:
    """Returns deterministic scenario by ID."""
    if scenario_id not in SCENARIOS:
        return SCENARIOS["GENUINE_RESOLUTION"]
    return SCENARIOS[scenario_id]
