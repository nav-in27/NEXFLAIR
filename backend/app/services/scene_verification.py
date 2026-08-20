"""
MEIKAAN Scene Consistency Engine
=================================
Determines whether a submitted verification image is visually consistent
with the original complaint scene using a SuperPoint + SuperGlue + RANSAC architecture.

IMPORTANT:
- Scene consistency score measures "visual scene similarity", NOT "worker visited location"
- Enforces strict geometric consistency via RANSAC.
"""

import io
import os
import time
import logging
from dataclasses import dataclass, field
from typing import Optional, List

import cv2
import numpy as np

from app.services.visual_verification.feature_extractor import SuperPointExtractor
from app.services.visual_verification.matcher import SuperGlueMatcher
from app.services.visual_verification.geometry import GeometricVerifier

logger = logging.getLogger("meikaan.scene_verification")

# ---------------------------------------------------------------------------
# Result data structures
# ---------------------------------------------------------------------------

@dataclass
class SceneMatchResult:
    """Immutable result from the scene consistency engine."""
    keypoints_before: int = 0
    keypoints_after: int = 0
    matches: int = 0
    valid_matches: int = 0
    valid_inliers: int = 0
    inlier_ratio: float = 0.0
    spatial_coverage: float = 0.0
    geometric_error: float = 0.0
    scene_status: str = "DIFFERENT_SCENE"  # STRONG_MATCH, WEAK_MATCH, UNCERTAIN, DIFFERENT_SCENE
    scene_score: float = 0.0
    method_used: str = "SUPERPOINT_SUPERGLUE"
    inference_time_ms: float = 0.0
    visualization_path: Optional[str] = None
    error: Optional[str] = None
    signals: List[dict] = field(default_factory=list)


class SceneVerificationService:
    def __init__(self):
        self.extractor = SuperPointExtractor()
        self.matcher = SuperGlueMatcher()
        self.verifier = GeometricVerifier()

    def analyze(self, before_img_path: str, after_img_path: str, session_id: str) -> SceneMatchResult:
        t0 = time.perf_counter()

        img_before = cv2.imread(before_img_path)
        img_after = cv2.imread(after_img_path)

        if img_before is None or img_after is None:
            elapsed = (time.perf_counter() - t0) * 1000
            return SceneMatchResult(
                error="Failed to load one or both images.",
                scene_status="DIFFERENT_SCENE",
                scene_score=0.0,
                inference_time_ms=elapsed
            )

        # 1. Feature Extraction (SuperPoint)
        kp_b, desc_b = self.extractor.extract(img_before)
        kp_a, desc_a = self.extractor.extract(img_after)

        kp_b_count = len(kp_b) if kp_b else 0
        kp_a_count = len(kp_a) if kp_a else 0

        # 2. Matching (SuperGlue)
        pts1, pts2, good_matches = self.matcher.match(kp_b, desc_b, kp_a, desc_a)
        
        valid_matches = len(good_matches)

        # 3. Geometric Verification (RANSAC & Coverage)
        geom_result = self.verifier.verify(pts1, pts2, img_before.shape)

        scene_status = geom_result["status"]
        valid_inliers = geom_result["inliers"]
        inlier_ratio = geom_result["inlier_ratio"]
        spatial_coverage = geom_result["spatial_coverage"]
        geometric_error = geom_result["geometric_error"]

        # Calculate Scene Score based on geometry
        scene_score = 0.0
        if scene_status == "STRONG_MATCH":
            scene_score = min(100.0, 50.0 + (inlier_ratio * 50.0))
        elif scene_status == "WEAK_MATCH":
            scene_score = min(70.0, 30.0 + (inlier_ratio * 40.0))
        elif scene_status == "UNCERTAIN":
            scene_score = 30.0
        else:
            scene_score = 0.0

        elapsed = (time.perf_counter() - t0) * 1000

        return SceneMatchResult(
            keypoints_before=kp_b_count,
            keypoints_after=kp_a_count,
            matches=valid_matches,
            valid_matches=valid_matches,
            valid_inliers=valid_inliers,
            inlier_ratio=inlier_ratio,
            spatial_coverage=spatial_coverage,
            geometric_error=geometric_error,
            scene_status=scene_status,
            scene_score=round(scene_score, 2),
            method_used="SUPERPOINT_SUPERGLUE_RANSAC",
            inference_time_ms=round(elapsed, 1),
        )

def get_scene_verification_service() -> SceneVerificationService:
    return SceneVerificationService()
