"""
Phase 7 – Hazard Change Engine Tests
======================================
Tests the HazardDetectionService (stagnant water detection, area reduction calculation,
mask overlay visualization generation) and API endpoint routing.

Test matrix:
1. Genuine cleanup     → Large reduction %, high resolution score
2. No cleanup          → 0% reduction, low resolution score
3. Partial cleanup     → Partial reduction %
4. No hazard in before → Flags requires_human_review = True
5. Poor/corrupt image  → Handled gracefully, flags human review
"""

import os
import cv2
import numpy as np
import pytest

from app.services.hazard_detection import (
    HazardDetectionService,
    HazardAnalysisResult,
    _ClassicalWaterDetector,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
)

# ──────────────────────────────────────────────────────────────────
# Test Data Helpers
# ──────────────────────────────────────────────────────────────────

def _create_water_puddle_image(puddle_radius: int = 120) -> np.ndarray:
    """
    Generate a synthetic image with a dark murky water puddle in the center
    and textured concrete background.
    """
    img = np.full((CANVAS_HEIGHT, CANVAS_WIDTH, 3), (120, 120, 120), dtype=np.uint8)
    
    # Add background noise/texture
    noise = np.random.randint(-15, 15, img.shape, dtype=np.int16)
    img = np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)

    # Draw dark murky stagnant water puddle (low saturation, dark value)
    if puddle_radius > 0:
        cv2.ellipse(
            img,
            (CANVAS_WIDTH // 2, CANVAS_HEIGHT // 2),
            (puddle_radius, int(puddle_radius * 0.65)),
            15, 0, 360,
            (65, 75, 60),  # Dark murky brown/grey-green BGR color
            -1
        )
    return img


def _create_clean_asphalt_image() -> np.ndarray:
    """Generate a clean dry asphalt image with no water puddles."""
    img = np.full((CANVAS_HEIGHT, CANVAS_WIDTH, 3), (160, 160, 160), dtype=np.uint8)
    noise = np.random.randint(-10, 10, img.shape, dtype=np.int16)
    return np.clip(img.astype(np.int16) + noise, 0, 255).astype(np.uint8)


# ──────────────────────────────────────────────────────────────────
# 1. Classical CV Detector Unit Tests
# ──────────────────────────────────────────────────────────────────

class TestClassicalWaterDetector:

    def test_detect_puddle(self):
        """Puddle image yields positive binary mask area."""
        detector = _ClassicalWaterDetector()
        img = _create_water_puddle_image(puddle_radius=120)
        mask, conf = detector.detect_water_mask(img)

        assert isinstance(mask, np.ndarray)
        area = int(np.sum(mask > 0))
        assert area > 500
        assert conf > 0.0

    def test_clean_dry_image_no_puddle(self):
        """Clean dry image yields zero or minimal water area."""
        detector = _ClassicalWaterDetector()
        img = _create_clean_asphalt_image()
        mask, conf = detector.detect_water_mask(img)

        area = int(np.sum(mask > 0))
        assert area < 200


# ──────────────────────────────────────────────────────────────────
# 2. HazardDetectionService Integration Tests
# ──────────────────────────────────────────────────────────────────

class TestHazardDetectionService:

    def test_genuine_cleanup(self):
        """Large puddle before, clean image after → high reduction % and resolution score."""
        svc = HazardDetectionService()
        img_before = _create_water_puddle_image(puddle_radius=140)
        img_after = _create_clean_asphalt_image()

        result = svc.analyze(before_image=img_before, after_image=img_after)

        assert isinstance(result, HazardAnalysisResult)
        assert result.before_hazard_area > 1000
        assert result.after_hazard_area < result.before_hazard_area
        assert result.hazard_reduction_percentage > 50.0
        assert result.hazard_resolution_score > 50.0
        assert result.error is None

    def test_no_cleanup(self):
        """Same puddle in before and after → 0% reduction, resolution score ~0."""
        svc = HazardDetectionService()
        img_before = _create_water_puddle_image(puddle_radius=120)
        img_after = _create_water_puddle_image(puddle_radius=120)

        result = svc.analyze(before_image=img_before, after_image=img_after)

        assert result.before_hazard_area > 0
        assert abs(result.hazard_reduction_percentage - 0.0) < 5.0
        assert result.hazard_resolution_score < 10.0

    def test_partial_cleanup(self):
        """Large puddle before, smaller puddle after → partial reduction %."""
        svc = HazardDetectionService()
        img_before = _create_water_puddle_image(puddle_radius=150)
        img_after = _create_water_puddle_image(puddle_radius=70)

        result = svc.analyze(before_image=img_before, after_image=img_after)

        assert result.before_hazard_area > result.after_hazard_area
        assert 10.0 < result.hazard_reduction_percentage < 90.0

    def test_no_hazard_in_before_image(self):
        """Clean before image (no hazard detected) → flags requires_human_review = True."""
        svc = HazardDetectionService()
        img_before = _create_clean_asphalt_image()
        img_after = _create_clean_asphalt_image()

        result = svc.analyze(before_image=img_before, after_image=img_after)

        assert result.requires_human_review is True
        assert result.review_reason is not None
        assert "BEFORE" in result.review_reason or "No significant" in result.review_reason

    def test_poor_corrupt_image_graceful(self):
        """Corrupt image returns error and flags human review without crashing."""
        svc = HazardDetectionService()
        result = svc.analyze(before_image=b"CORRUPT_BYTES", after_image=_create_clean_asphalt_image())

        assert result.error is not None
        assert result.requires_human_review is True

    def test_visualization_saved(self, tmp_path):
        """Visualization PNG file is created with mask overlays."""
        svc = HazardDetectionService()
        img_b = _create_water_puddle_image(puddle_radius=100)
        img_a = _create_clean_asphalt_image()
        viz_dir = str(tmp_path / "viz")

        result = svc.analyze(
            before_image=img_b,
            after_image=img_a,
            visualization_dir=viz_dir,
            session_id="test-hazard-session-456",
        )

        assert result.visualization_path is not None
        assert os.path.isfile(result.visualization_path)
        assert result.visualization_path.endswith(".png")

    def test_signals_structure(self):
        """Signals list contains required hazard signals."""
        svc = HazardDetectionService()
        img_b = _create_water_puddle_image(puddle_radius=100)
        img_a = _create_clean_asphalt_image()

        result = svc.analyze(before_image=img_b, after_image=img_a)

        assert len(result.signals) >= 8
        sig_names = {s["signal_name"] for s in result.signals}
        expected = {
            "hazard_type", "before_hazard_area_px", "after_hazard_area_px",
            "hazard_reduction_percentage", "hazard_resolution_score",
            "hazard_method_used", "hazard_inference_time_ms", "requires_human_review"
        }
        assert expected.issubset(sig_names)
