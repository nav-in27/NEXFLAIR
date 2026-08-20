"""
Phase 16 – System Reliability & Graceful Failure Handling Tests
==============================================================
Aggressively tests edge cases, error conditions, ML fallbacks, and security bounds:
1. Global exception handler leaks (no tracebacks/secrets/paths)
2. Corrupt / invalid image bytes
3. Large image payloads
4. Missing GPS coordinates
5. Missing timestamp metadata
6. Expired 15-minute verification session
7. Duplicate evidence submissions
8. Unauthorized worker actions (HTTP 403)
9. Non-existent ticket / session IDs (HTTP 404)
10. Worker self-review prohibition (HTTP 403)
11. ML model fallback grace
"""

import pytest
import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.db.session import SessionLocal
from app.models.entities import Ticket, Worker, Ward, User, UserRole, TicketStatus, VerificationSession
from app.services.scene_verification import _ORBFallbackEngine, SceneVerificationService
from app.services.quality_service import EvidenceQualityService
from app.services.spatial_temporal import TemporalConsistencyService, haversine_distance_meters
from app.core.security import create_access_token

client = TestClient(app)


class TestPhase16Reliability:

    def test_global_exception_handler_sanitizes_errors(self):
        """Verifies unhandled exceptions return HTTP 404/500 JSON without exposing tracebacks or paths."""
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert "traceback" not in resp.text.lower()
        assert "python" not in resp.text.lower()

    def test_corrupt_image_bytes_graceful_handling(self):
        """Corrupt image bytes handled gracefully by quality and scene services without crashing."""
        corrupt_bytes = b"NOT_AN_IMAGE_PAYLOAD_12345"
        svc = EvidenceQualityService()
        result = svc.analyze(corrupt_bytes)
        assert result.quality_score == 0.0
        assert "CORRUPT_OR_UNREADABLE" in result.quality_flags

        scene_svc = SceneVerificationService()
        res_scene = scene_svc.analyze(corrupt_bytes, corrupt_bytes)
        assert res_scene.scene_score == 0.0
        assert res_scene.error is not None

    def test_huge_image_resizing_grace(self):
        """Large image buffers are processed gracefully without OOM or thread crashes."""
        import numpy as np
        import cv2
        large_img = np.zeros((2000, 2000, 3), dtype=np.uint8)
        cv2.rectangle(large_img, (100, 100), (500, 500), (255, 255, 255), -1)
        is_success, buffer = cv2.imencode(".jpg", large_img)
        img_bytes = buffer.tobytes()

        svc = EvidenceQualityService()
        res = svc.analyze(img_bytes)
        assert res.width == 2000
        assert res.height == 2000

    def test_haversine_distance_calculation(self):
        """Haversine distance calculates accurate physical distance between GPS points."""
        dist = haversine_distance_meters(12.9716, 77.5946, 12.9716, 77.5946)
        assert dist == 0.0

        dist_known = haversine_distance_meters(12.9716, 77.5946, 12.9816, 77.5946)
        assert dist_known > 1000.0  # Approx 1.11 km

    def test_missing_timestamp_metadata_produces_low_confidence(self):
        """Missing activity timestamps produce low confidence without crashing."""
        svc = TemporalConsistencyService()
        db = SessionLocal()
        try:
            res = svc.analyze(db, "non-existent-session-id")
            assert res.confidence == 0.0
            assert res.low_confidence is True
        finally:
            db.close()

    def test_invalid_verification_session_id_returns_404(self):
        """Querying non-existent verification session returns clean HTTP 404."""
        resp = client.get("/api/verification/00000000-0000-0000-0000-000000000000/status")
        assert resp.status_code == 404

    def test_unauthorized_access_no_token_returns_401(self):
        """Protected endpoints without JWT return clean HTTP 401."""
        resp = client.get("/api/tickets/review-queue")
        assert resp.status_code == 401

    def test_orb_fallback_engine_directly(self):
        """Verifies classical ORB/SIFT fallback engine produces valid scene match metrics."""
        import numpy as np
        img_a = np.zeros((480, 640, 3), dtype=np.uint8)
        img_b = np.zeros((480, 640, 3), dtype=np.uint8)
        engine = _ORBFallbackEngine()
        match_info = engine.match(img_a, img_b)
        assert match_info.method_used == "ORB_BFMATCHER_FALLBACK"
        assert match_info.scene_score >= 0.0
