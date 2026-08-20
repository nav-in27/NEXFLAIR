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


def _load_image_input(image_input):
    """Loads a scene image from a numpy array, file path, or raw image bytes."""
    if isinstance(image_input, np.ndarray):
        img = image_input
    elif isinstance(image_input, bytes):
        arr = np.frombuffer(image_input, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    elif isinstance(image_input, str):
        img = cv2.imread(image_input)
    else:
        raise ValueError(f"Unsupported image input type: {type(image_input)}")

    if img is None or img.size == 0:
        raise ValueError("Failed to load one or both images.")
    return img

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


class _ORBFallbackEngine:
    """
    Backwards-compatible ORB-based scene matcher used by older tests.
    The current visual pipeline already falls back to ORB internally, so
    this wrapper preserves the legacy API surface without changing behavior.
    """

    def __init__(self):
        self.extractor = SuperPointExtractor()
        self.matcher = SuperGlueMatcher()
        self.verifier = GeometricVerifier()

    def match(self, before_image, after_image, visualization_dir: Optional[str] = None, session_id: Optional[str] = None) -> SceneMatchResult:
        t0 = time.perf_counter()

        try:
            img_before = _load_image_input(before_image)
            img_after = _load_image_input(after_image)
        except Exception as exc:
            elapsed = (time.perf_counter() - t0) * 1000
            signals = [
                {"signal_name": "scene_keypoints_before", "signal_value": "0", "confidence": 0.0},
                {"signal_name": "scene_keypoints_after", "signal_value": "0", "confidence": 0.0},
                {"signal_name": "scene_total_matches", "signal_value": "0", "confidence": 0.0},
                {"signal_name": "scene_valid_matches", "signal_value": "0", "confidence": 0.0},
                {"signal_name": "scene_valid_inliers", "signal_value": "0", "confidence": 0.0},
                {"signal_name": "scene_status", "signal_value": "DIFFERENT_SCENE", "confidence": 0.0},
                {"signal_name": "scene_match_ratio", "signal_value": "0.0", "confidence": 0.0},
                {"signal_name": "scene_consistency_score", "signal_value": "0.0", "confidence": 0.0},
                {"signal_name": "scene_method_used", "signal_value": "ORB_BFMATCHER_FALLBACK", "confidence": 1.0},
                {"signal_name": "scene_inference_time_ms", "signal_value": str(round(elapsed, 1)), "confidence": 1.0},
            ]
            return SceneMatchResult(
                scene_status="DIFFERENT_SCENE",
                scene_score=0.0,
                method_used="ORB_BFMATCHER_FALLBACK",
                inference_time_ms=round(elapsed, 1),
                error=str(exc),
                signals=signals,
            )

        kp_b, desc_b = self.extractor.extract(img_before)
        kp_a, desc_a = self.extractor.extract(img_after)
        kp_b_count = len(kp_b) if kp_b else 0
        kp_a_count = len(kp_a) if kp_a else 0

        match_result = self.matcher.match(kp_b, desc_b, kp_a, desc_a)
        if len(match_result) == 3:
            pts1, pts2, good_matches = match_result
        else:
            pts1, pts2 = match_result
            good_matches = []
        valid_matches = len(good_matches)

        geom_result = self.verifier.verify(pts1, pts2, img_before.shape)
        scene_status = geom_result["status"]
        valid_inliers = geom_result["inliers"]
        inlier_ratio = geom_result["inlier_ratio"]
        spatial_coverage = geom_result["spatial_coverage"]
        geometric_error = geom_result["geometric_error"]

        if scene_status == "STRONG_MATCH":
            scene_score = min(100.0, 50.0 + (inlier_ratio * 50.0))
        elif scene_status == "WEAK_MATCH":
            scene_score = min(70.0, 30.0 + (inlier_ratio * 40.0))
        elif scene_status == "UNCERTAIN":
            scene_score = 30.0
        else:
            scene_score = 0.0

        if visualization_dir:
            try:
                os.makedirs(visualization_dir, exist_ok=True)
                fname = f"scene_match_{session_id or 'unknown'}.png"
                target_path = os.path.join(visualization_dir, fname)
                vis_before = cv2.resize(img_before, (640, 480))
                vis_after = cv2.resize(img_after, (640, 480))
                combined = np.hstack([vis_before, vis_after])
                cv2.imwrite(target_path, combined)
                visualization_path = target_path
            except Exception:
                visualization_path = None
        else:
            visualization_path = None

        elapsed = round((time.perf_counter() - t0) * 1000, 1)
        match_ratio = round(valid_inliers / max(1, valid_matches), 4)

        signals = [
            {"signal_name": "scene_keypoints_before", "signal_value": str(kp_b_count), "confidence": 1.0},
            {"signal_name": "scene_keypoints_after", "signal_value": str(kp_a_count), "confidence": 1.0},
            {"signal_name": "scene_total_matches", "signal_value": str(len(good_matches)), "confidence": 1.0},
            {"signal_name": "scene_valid_matches", "signal_value": str(valid_matches), "confidence": 1.0},
            {"signal_name": "scene_valid_inliers", "signal_value": str(valid_inliers), "confidence": 1.0},
            {"signal_name": "scene_status", "signal_value": scene_status, "confidence": 1.0},
            {"signal_name": "scene_match_ratio", "signal_value": str(match_ratio), "confidence": 1.0},
            {"signal_name": "scene_consistency_score", "signal_value": str(round(scene_score, 2)), "confidence": 1.0},
            {"signal_name": "scene_method_used", "signal_value": "ORB_BFMATCHER_FALLBACK", "confidence": 1.0},
            {"signal_name": "scene_inference_time_ms", "signal_value": str(elapsed), "confidence": 1.0},
        ]

        return SceneMatchResult(
            keypoints_before=kp_b_count,
            keypoints_after=kp_a_count,
            matches=len(good_matches),
            valid_matches=valid_matches,
            valid_inliers=valid_inliers,
            inlier_ratio=inlier_ratio,
            spatial_coverage=spatial_coverage,
            geometric_error=geometric_error,
            scene_status=scene_status,
            scene_score=round(scene_score, 2),
            method_used="ORB_BFMATCHER_FALLBACK",
            inference_time_ms=elapsed,
            visualization_path=visualization_path,
            signals=signals,
        )


class SceneVerificationService:
    def __init__(self):
        self._engine = _ORBFallbackEngine()

    def analyze(self, before_image, after_image, visualization_dir: Optional[str] = None, session_id: Optional[str] = None) -> SceneMatchResult:
        return self._engine.match(
            before_image=before_image,
            after_image=after_image,
            visualization_dir=visualization_dir,
            session_id=session_id,
        )

def get_scene_verification_service() -> SceneVerificationService:
    return SceneVerificationService()
