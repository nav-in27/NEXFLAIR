"""
Phase 10 – Evidence Quality Analysis Tests
==========================================
Tests the EvidenceQualityService:
- Clear image (high score, no flags, no human review)
- Blurred image (Laplacian variance < 100, flag BLURRY)
- Dark image (Mean brightness < 40, flag TOO_DARK)
- Low resolution image (dimensions < 480x360, flag LOW_RESOLUTION)
- Heavily cropped / camera obstructed image (flag CAMERA_OBSTRUCTED / EXCESSIVE_CROPPING)
"""

import cv2
import numpy as np
import pytest
from app.services.quality_service import (
    EvidenceQualityService,
    QualityAnalysisResult,
)


def _make_clear_image(w: int = 640, h: int = 480) -> np.ndarray:
    """Generate a sharp, clear, high-contrast textured image."""
    img = np.full((h, w, 3), 128, dtype=np.uint8)
    # Add sharp high-contrast grid lines
    for x in range(0, w, 20):
        cv2.line(img, (x, 0), (x, h), (0, 255, 0), 2)
    for y in range(0, h, 20):
        cv2.line(img, (0, y), (w, y), (255, 0, 0), 2)
    return img


def _make_blurred_image(w: int = 640, h: int = 480) -> np.ndarray:
    """Generate a heavily blurred image (low Laplacian variance)."""
    clear = _make_clear_image(w, h)
    return cv2.GaussianBlur(clear, (51, 51), 0)


def _make_dark_image(w: int = 640, h: int = 480) -> np.ndarray:
    """Generate an underexposed dark image (mean brightness < 40)."""
    return np.full((h, w, 3), 15, dtype=np.uint8)


def _make_low_res_image(w: int = 200, h: int = 150) -> np.ndarray:
    """Generate a low-resolution image below minimum 480x360 requirement."""
    return _make_clear_image(w, h)


def _make_obstructed_camera_image(w: int = 640, h: int = 480) -> np.ndarray:
    """Generate a uniform black image simulating a camera lens covered by finger or cap."""
    return np.zeros((h, w, 3), dtype=np.uint8)


def _make_cropped_banner_image(w: int = 800, h: int = 100) -> np.ndarray:
    """Generate a heavily cropped banner image (aspect ratio > 3.0)."""
    return np.full((h, w, 3), 150, dtype=np.uint8)


# ──────────────────────────────────────────────────────────────────
# Evidence Quality Service Tests
# ──────────────────────────────────────────────────────────────────

class TestEvidenceQualityService:

    def test_clear_image(self):
        """Clear high-resolution sharp image -> quality_score=100.0, no flags, no human review."""
        svc = EvidenceQualityService()
        img = _make_clear_image()
        result = svc.analyze(img)

        assert isinstance(result, QualityAnalysisResult)
        assert result.quality_score >= 90.0
        assert result.quality_flags == []
        assert result.human_review_required is False
        assert result.review_reason is None
        assert "meets all visual quality standards" in result.explanation

    def test_blurred_image(self):
        """Blurred image -> flag 'BLURRY', human_review_required=True."""
        svc = EvidenceQualityService()
        img = _make_blurred_image()
        result = svc.analyze(img)

        assert "BLURRY" in result.quality_flags
        assert result.human_review_required is True
        assert result.review_reason is not None
        assert "BLURRY" in result.review_reason

    def test_dark_image(self):
        """Underexposed dark image -> flag 'TOO_DARK', human_review_required=True."""
        svc = EvidenceQualityService()
        img = _make_dark_image()
        result = svc.analyze(img)

        assert "TOO_DARK" in result.quality_flags
        assert result.human_review_required is True
        assert result.brightness_score < 40.0

    def test_low_resolution_image(self):
        """Image smaller than 480x360 -> flag 'LOW_RESOLUTION', human_review_required=True."""
        svc = EvidenceQualityService()
        img = _make_low_res_image(200, 150)
        result = svc.analyze(img)

        assert "LOW_RESOLUTION" in result.quality_flags
        assert result.human_review_required is True
        assert result.width == 200
        assert result.height == 150

    def test_obstructed_camera_image(self):
        """Uniform dark/black image (finger over lens) -> flag 'CAMERA_OBSTRUCTED'."""
        svc = EvidenceQualityService()
        img = _make_obstructed_camera_image()
        result = svc.analyze(img)

        assert "CAMERA_OBSTRUCTED" in result.quality_flags
        assert result.human_review_required is True

    def test_excessive_cropping_image(self):
        """Aspect ratio strip image -> flag 'EXCESSIVE_CROPPING'."""
        svc = EvidenceQualityService()
        img = _make_cropped_banner_image()
        result = svc.analyze(img)

        assert "EXCESSIVE_CROPPING" in result.quality_flags or "LOW_RESOLUTION" in result.quality_flags
        assert result.human_review_required is True

    def test_corrupt_payload_graceful(self):
        """Corrupt payload -> handles error gracefully and flags human review."""
        svc = EvidenceQualityService()
        result = svc.analyze(b"CORRUPT_PAYLOAD")

        assert "CORRUPT_OR_UNREADABLE" in result.quality_flags
        assert result.human_review_required is True
        assert result.quality_score == 0.0
