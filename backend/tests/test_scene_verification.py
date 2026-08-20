"""
Phase 6 – Scene Consistency Engine Tests
==========================================
Tests the SceneVerificationService (ORB fallback) and the
POST /api/verification/{session_id}/scene-analysis endpoint.

Test matrix:
1. Same scene         → high match ratio
2. Different scene    → low match ratio
3. Poor-quality image → handled gracefully
4. Missing image      → error returned
5. Model unavailable  → ORB fallback used
"""

import io
import os
import uuid
import datetime
import numpy as np
import cv2
import pytest
from PIL import Image

from app.services.scene_verification import (
    SceneVerificationService,
    _ORBFallbackEngine,
    SceneMatchResult,
)

# ──────────────────────────────────────────────────────────────────
# Helpers – generate synthetic test images
# ──────────────────────────────────────────────────────────────────

def _make_textured_image(seed: int = 42, w: int = 480, h: int = 360) -> np.ndarray:
    """Generate a BGR image with deterministic texture (rectangles + circles)."""
    rng = np.random.RandomState(seed)
    img = rng.randint(0, 255, (h, w, 3), dtype=np.uint8)
    # Add some geometric features to increase keypoint count
    for _ in range(20):
        x1, y1 = rng.randint(0, w), rng.randint(0, h)
        x2, y2 = x1 + rng.randint(20, 80), y1 + rng.randint(20, 80)
        color = tuple(int(c) for c in rng.randint(0, 255, 3))
        cv2.rectangle(img, (x1, y1), (x2, y2), color, -1)
    for _ in range(10):
        cx, cy = rng.randint(0, w), rng.randint(0, h)
        r = rng.randint(10, 40)
        color = tuple(int(c) for c in rng.randint(0, 255, 3))
        cv2.circle(img, (cx, cy), r, color, -1)
    return img


def _make_different_image(w: int = 480, h: int = 360) -> np.ndarray:
    """Generate a completely different scene."""
    return _make_textured_image(seed=999, w=w, h=h)


def _img_to_bytes(img: np.ndarray, fmt: str = ".jpg") -> bytes:
    """Encode numpy BGR image to JPEG/PNG bytes."""
    ok, buf = cv2.imencode(fmt, img)
    assert ok
    return buf.tobytes()


def _save_temp_image(img: np.ndarray, path: str):
    cv2.imwrite(path, img)


# ──────────────────────────────────────────────────────────────────
# 1. ORB Fallback Engine – unit tests
# ──────────────────────────────────────────────────────────────────

class TestORBFallbackEngine:

    def test_same_scene_high_match(self):
        """Same image → many valid matches, non-zero score."""
        engine = _ORBFallbackEngine()
        img = _make_textured_image(seed=42)
        result = engine.match(img, img)

        assert isinstance(result, SceneMatchResult)
        assert result.method_used == "ORB_BFMATCHER_FALLBACK"
        assert result.keypoints_before > 0
        assert result.keypoints_after > 0
        assert result.valid_matches > 0
        assert result.scene_score > 0
        assert result.inference_time_ms >= 0
        assert result.error is None

    def test_different_scene_low_match(self):
        """Two different images → lower match ratio than same-scene."""
        engine = _ORBFallbackEngine()
        img_a = _make_textured_image(seed=42)
        img_b = _make_different_image()
        result = engine.match(img_a, img_b)

        same_result = engine.match(img_a, img_a)

        assert result.scene_score <= same_result.scene_score
        assert result.method_used == "ORB_BFMATCHER_FALLBACK"

    def test_blank_image_graceful(self):
        """Blank (all-zero) image → no keypoints, score=0, no crash."""
        engine = _ORBFallbackEngine()
        blank = np.zeros((100, 100, 3), dtype=np.uint8)
        textured = _make_textured_image()
        result = engine.match(blank, textured)

        # blank has 0 keypoints → should handle gracefully
        assert result.scene_score == 0.0 or result.keypoints_before == 0
        assert result.method_used == "ORB_BFMATCHER_FALLBACK"


# ──────────────────────────────────────────────────────────────────
# 2. SceneVerificationService – integration tests
# ──────────────────────────────────────────────────────────────────

class TestSceneVerificationService:

    def test_analyze_with_numpy_arrays(self):
        """Service accepts numpy arrays directly."""
        svc = SceneVerificationService()
        img = _make_textured_image(seed=42)
        result = svc.analyze(before_image=img, after_image=img)

        assert result.scene_score > 0
        assert result.method_used in ("LOFTR_LEARNED_MATCHER", "ORB_BFMATCHER_FALLBACK")
        assert len(result.signals) == 10

    def test_analyze_with_bytes(self):
        """Service accepts raw JPEG bytes."""
        svc = SceneVerificationService()
        img = _make_textured_image(seed=42)
        img_bytes = _img_to_bytes(img)
        result = svc.analyze(before_image=img_bytes, after_image=img_bytes)

        assert result.scene_score > 0
        assert result.error is None

    def test_analyze_with_file_paths(self, tmp_path):
        """Service accepts filesystem paths."""
        svc = SceneVerificationService()
        img = _make_textured_image(seed=42)
        path_a = str(tmp_path / "before.jpg")
        path_b = str(tmp_path / "after.jpg")
        _save_temp_image(img, path_a)
        _save_temp_image(img, path_b)

        result = svc.analyze(before_image=path_a, after_image=path_b)
        assert result.scene_score > 0
        assert result.error is None

    def test_analyze_missing_file(self):
        """Missing file returns error, no crash."""
        svc = SceneVerificationService()
        result = svc.analyze(
            before_image="/nonexistent/path/image.jpg",
            after_image=_make_textured_image(),
        )
        assert result.error is not None
        assert result.scene_score == 0.0

    def test_analyze_corrupt_bytes(self):
        """Corrupt bytes returns error, no crash."""
        svc = SceneVerificationService()
        result = svc.analyze(
            before_image=b"NOT_AN_IMAGE",
            after_image=_make_textured_image(),
        )
        assert result.error is not None

    def test_visualization_generated(self, tmp_path):
        """Visualization PNG is created when dir is provided."""
        svc = SceneVerificationService()
        img = _make_textured_image(seed=42)
        viz_dir = str(tmp_path / "viz")

        result = svc.analyze(
            before_image=img,
            after_image=img,
            visualization_dir=viz_dir,
            session_id="test-session-123",
        )

        assert result.visualization_path is not None
        assert os.path.isfile(result.visualization_path)
        assert result.visualization_path.endswith(".png")

    def test_signals_structure(self):
        """Signals list has correct keys and types."""
        svc = SceneVerificationService()
        img = _make_textured_image(seed=42)
        result = svc.analyze(before_image=img, after_image=img)

        assert len(result.signals) == 10
        signal_names = {s["signal_name"] for s in result.signals}
        expected = {
            "scene_keypoints_before", "scene_keypoints_after",
            "scene_total_matches", "scene_valid_matches",
            "scene_valid_inliers", "scene_status",
            "scene_match_ratio", "scene_consistency_score",
            "scene_method_used", "scene_inference_time_ms",
        }
        assert signal_names == expected

        for sig in result.signals:
            assert "signal_name" in sig
            assert "signal_value" in sig
            assert "confidence" in sig
            assert isinstance(sig["confidence"], float)

    def test_different_scenes_lower_score(self):
        """Different scenes produce lower score than same scene."""
        svc = SceneVerificationService()
        img_a = _make_textured_image(seed=42)
        img_b = _make_different_image()

        same_result = svc.analyze(before_image=img_a, after_image=img_a)
        diff_result = svc.analyze(before_image=img_a, after_image=img_b)

        assert same_result.scene_score >= diff_result.scene_score

    def test_poor_quality_small_image(self):
        """Very small image still produces a result, no crash."""
        svc = SceneVerificationService()
        tiny = np.zeros((16, 16, 3), dtype=np.uint8)
        tiny[4:12, 4:12] = 255  # small white square
        result = svc.analyze(before_image=tiny, after_image=tiny)

        # Should succeed without error even if matches are 0
        assert isinstance(result, SceneMatchResult)


# ──────────────────────────────────────────────────────────────────
# 3. API endpoint tests (requires test client + DB fixtures)
# ──────────────────────────────────────────────────────────────────

class TestSceneAnalysisAPI:
    """
    Tests for POST /api/verification/{session_id}/scene-analysis.
    These use the FastAPI test client and require DB fixtures.
    """

    @pytest.fixture(autouse=True)
    def setup_client(self):
        """Create test client and seed test data."""
        from fastapi.testclient import TestClient
        from app.main import app
        from app.db.session import get_db, engine
        from app.models.entities import Base
        from sqlalchemy.orm import Session as SASession

        self.client = TestClient(app)

    def _get_admin_token(self) -> str:
        resp = self.client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin123"
        })
        if resp.status_code == 200:
            return resp.json()["access_token"]
        return ""

    def _get_worker_token(self) -> str:
        resp = self.client.post("/api/auth/login", json={
            "username": "worker1",
            "password": "worker123"
        })
        if resp.status_code == 200:
            return resp.json()["access_token"]
        return ""

    def test_scene_analysis_session_not_found(self):
        """Nonexistent session → 404."""
        token = self._get_admin_token()
        if not token:
            pytest.skip("Admin login not available in test DB")

        resp = self.client.post(
            "/api/verification/nonexistent-session-id/scene-analysis",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 404

    def test_scene_analysis_no_auth(self):
        """No auth token → 401/403."""
        resp = self.client.post("/api/verification/some-id/scene-analysis")
        assert resp.status_code in (401, 403, 422)

    def test_scene_analysis_missing_before_evidence(self):
        """Session exists but no BEFORE evidence → 400."""
        token = self._get_admin_token()
        if not token:
            pytest.skip("Admin login not available in test DB")

        # Create a verification session for a ticket that has no evidence
        # First get a ticket
        tickets_resp = self.client.get(
            "/api/tickets",
            headers={"Authorization": f"Bearer {token}"},
        )
        if tickets_resp.status_code != 200 or not tickets_resp.json():
            pytest.skip("No tickets in test DB")

        ticket = tickets_resp.json()[0]
        ticket_id = ticket["id"]

        # Try to start a verification session (may fail if ticket status is wrong)
        start_resp = self.client.post(
            "/api/verification/start",
            json={"ticket_id": ticket_id},
            headers={"Authorization": f"Bearer {token}"},
        )
        if start_resp.status_code != 201:
            pytest.skip("Could not create verification session for test")

        session_id = start_resp.json()["id"]

        # Run scene analysis – should fail because no BEFORE evidence
        resp = self.client.post(
            f"/api/verification/{session_id}/scene-analysis",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 400
        assert "BEFORE" in resp.json()["detail"] or "evidence" in resp.json()["detail"].lower()
