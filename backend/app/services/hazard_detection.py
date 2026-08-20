"""
MEIKAAN Hazard Change Engine
============================
Detects civic hazards (primarily STAGNANT_WATER) in BEFORE and AFTER/LIVE_VERIFICATION
images to calculate the visual hazard-area reduction.

Primary Pipeline:  YOLO segmentation/detection model (ultralytics)
Fallback Pipeline: Classical Computer Vision (HSV color segmentation + local texture smoothness)

IMPORTANT:
- Measures "Visual hazard-area reduction", NOT physical volume or complete remediation.
- Never generates random or fake scores.
- Handles edge cases: no hazard detected, low confidence, corrupt/missing images.
- Recommends HUMAN_REVIEW routing if confidence is insufficient.
"""

import io
import os
import time
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger("meikaan.hazard_detection")

# Standard canvas dimension for consistent area comparisons across different camera resolutions
CANVAS_WIDTH = 640
CANVAS_HEIGHT = 480
CANVAS_TOTAL_PIXELS = CANVAS_WIDTH * CANVAS_HEIGHT


@dataclass
class HazardAnalysisResult:
    """Immutable result from the Hazard Change Engine."""
    hazard_type: str = "STAGNANT_WATER"
    before_hazard_area: int = 0
    after_hazard_area: int = 0
    hazard_reduction_percentage: float = 0.0
    hazard_resolution_score: float = 0.0
    confidence: float = 0.0
    method_used: str = "NONE"
    inference_time_ms: float = 0.0
    requires_human_review: bool = False
    review_reason: Optional[str] = None
    visualization_path: Optional[str] = None
    error: Optional[str] = None
    signals: List[dict] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Classical CV Stagnant Water Detector (Fallback)
# ---------------------------------------------------------------------------

class _ClassicalWaterDetector:
    """
    Classical Computer Vision detector for stagnant water puddles.
    Analyzes HSV color properties (dark/murky low-saturation tones) combined
    with low local variance / smooth texture characteristic of standing water surfaces.
    """

    def detect_water_mask(self, img_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
        """
        Detects stagnant water regions in a BGR image.
        Returns (binary_mask_uint8, confidence_score).
        """
        if img_bgr is None or img_bgr.size == 0:
            return np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8), 0.0

        # Resize to standard canvas for uniform pixel count metric
        resized = cv2.resize(img_bgr, (CANVAS_WIDTH, CANVAS_HEIGHT), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        h, s, v = cv2.split(hsv)

        # Scene context statistics
        gray_mean = float(np.mean(gray))
        gray_std_global = float(np.std(gray))

        # 1. Stagnant water criteria:
        # Puddles are typically darker than surrounding dry ground (v < gray_mean - 15)
        # OR have murky tint (H in [10..140], S in [12..180], V in [20..150])
        dark_water_mask = (v < max(30.0, gray_mean - 15.0)).astype(np.uint8) * 255
        murky_color_mask = cv2.inRange(hsv, (10, 12, 20), (140, 180, 150))
        
        water_candidates = cv2.bitwise_or(dark_water_mask, murky_color_mask)

        # 2. Local Texture Smoothness Analysis (water surface is locally smooth)
        mean_blur = cv2.blur(gray.astype(np.float32), (9, 9))
        sqr_blur = cv2.blur((gray.astype(np.float32)) ** 2, (9, 9))
        local_std = np.sqrt(np.maximum(sqr_blur - mean_blur ** 2, 0))

        # Water surfaces are locally smooth (low standard deviation < 18)
        smooth_mask = (local_std < 18.0).astype(np.uint8) * 255

        # 3. Combine Water Candidates & Smoothness
        combined = cv2.bitwise_and(water_candidates, smooth_mask)

        # Morphological Cleanup (Opening removes speckles, Closing connects puddle regions)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        cleaned = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel, iterations=1)
        cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=2)

        # Contour Area & Relative Boundary Filtering
        final_mask = np.zeros_like(cleaned)
        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        total_puddle_pixels = 0
        valid_contour_count = 0
        
        for cnt in contours:
            area = cv2.contourArea(cnt)
            # Must be a contiguous region (> 300 px) and not cover > 70% of the canvas
            if 300 <= area <= (CANVAS_TOTAL_PIXELS * 0.70):
                cv2.drawContours(final_mask, [cnt], -1, 255, -1)
                total_puddle_pixels += int(area)
                valid_contour_count += 1

        # Calculate detector confidence
        if total_puddle_pixels == 0:
            confidence = 0.85  # Confident that no significant puddle is present
        else:
            coverage_ratio = total_puddle_pixels / CANVAS_TOTAL_PIXELS
            if 0.01 <= coverage_ratio <= 0.50:
                confidence = min(0.85, 0.65 + (valid_contour_count * 0.05))
            else:
                confidence = 0.50

        return final_mask, confidence


# ---------------------------------------------------------------------------
# Classical CV Road Defect / Pothole Detector
# ---------------------------------------------------------------------------

class _ClassicalRoadDefectDetector:
    """
    Classical Computer Vision detector for potholes and road defect cavities.
    Analyzes morphological blackhat depressions weighted by rim boundary gradient
    to isolate true road cavities from flat aggregate/gravel pavement textures.
    """
    def detect_defect_mask(self, img_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
        if img_bgr is None or img_bgr.size == 0:
            return np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8), 0.0

        resized = cv2.resize(img_bgr, (CANVAS_WIDTH, CANVAS_HEIGHT), interpolation=cv2.INTER_AREA)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)
        blurred = cv2.GaussianBlur(gray, (7, 7), 0)

        # 1. Gradient magnitude (rim boundaries of potholes)
        grad_x = cv2.Sobel(blurred, cv2.CV_32F, 1, 0, ksize=3)
        grad_y = cv2.Sobel(blurred, cv2.CV_32F, 0, 1, ksize=3)
        mag = cv2.magnitude(grad_x, grad_y)

        # 2. Morphological Blackhat (cavity depth depressions)
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (35, 35))
        blackhat = cv2.morphologyEx(blurred, cv2.MORPH_BLACKHAT, kernel)

        # 3. Combined Depth-Gradient Product
        depth_score = blackhat * (mag / 255.0)

        # 4. Cavity threshold for genuine structural depressions
        cavity_mask = (depth_score >= 12.0).astype(np.uint8) * 255

        # Mask out boundary border strips to eliminate camera crop/vignette artifacts
        cavity_mask[:18, :] = 0
        cavity_mask[-18:, :] = 0
        cavity_mask[:, :18] = 0
        cavity_mask[:, -18:] = 0

        # Morphological consolidation
        kernel_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (9, 9))
        cleaned = cv2.morphologyEx(cavity_mask, cv2.MORPH_CLOSE, kernel_clean)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask = np.zeros_like(gray)
        total_defect_pixels = 0

        for cnt in contours:
            area = cv2.contourArea(cnt)
            x, y, w, h = cv2.boundingRect(cnt)
            aspect = max(w, h) / max(1.0, min(w, h))
            if 150 <= area <= (CANVAS_TOTAL_PIXELS * 0.40) and aspect < 5.0:
                cv2.drawContours(mask, [cnt], -1, 255, -1)
                total_defect_pixels += int(area)

        conf = 0.85 if total_defect_pixels > 300 else 0.70
        return mask, conf


class _ClassicalGarbageDetector:
    """
    Classical Computer Vision detector for garbage / solid waste dumps.
    Analyzes high local color variance, multi-hued trash clusters, and high local texture entropy.
    """
    def detect_garbage_mask(self, img_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
        if img_bgr is None or img_bgr.size == 0:
            return np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8), 0.0

        resized = cv2.resize(img_bgr, (CANVAS_WIDTH, CANVAS_HEIGHT), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
        gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

        # Waste clusters display high localized saturation variance and diverse hues
        h, s, v = cv2.split(hsv)
        s_lap = cv2.Laplacian(s, cv2.CV_32F)
        s_std_mag = np.abs(s_lap)

        waste_mask = ((s_std_mag > 22.0) & (v > 35)).astype(np.uint8) * 255
        waste_mask[:15, :] = 0
        waste_mask[-15:, :] = 0
        waste_mask[:, :15] = 0
        waste_mask[:, -15:] = 0

        kernel_clean = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (11, 11))
        cleaned = cv2.morphologyEx(waste_mask, cv2.MORPH_CLOSE, kernel_clean)

        contours, _ = cv2.findContours(cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        mask = np.zeros_like(gray)
        total_waste_pixels = 0
        for cnt in contours:
            area = cv2.contourArea(cnt)
            if 200 <= area <= (CANVAS_TOTAL_PIXELS * 0.50):
                cv2.drawContours(mask, [cnt], -1, 255, -1)
                total_waste_pixels += int(area)

        conf = 0.80 if total_waste_pixels > 300 else 0.65
        return mask, conf


# ---------------------------------------------------------------------------
# YOLO Hazard Detector (Primary)
# ---------------------------------------------------------------------------

class _YOLOHazardDetector:
    """Wraps Ultralytics YOLO segmentation/detection model."""

    def __init__(self):
        self._available = False
        self._model = None
        self._load()

    def _load(self):
        try:
            import importlib
            ultralytics_pkg = importlib.import_module("ultralytics")
            yolo_cls = getattr(ultralytics_pkg, "YOLO", None)
            if yolo_cls is None:
                raise ImportError("YOLO class not found in ultralytics package")

            logger.info("[HazardEngine] Attempting to load YOLO model…")
            # Load nano segmentation model for fast CPU execution
            self._model = yolo_cls("yolov8n-seg.pt")
            self._available = True
            logger.info("[HazardEngine] ✓ YOLO segmentation model loaded successfully.")
        except Exception as exc:
            logger.warning("[HazardEngine] YOLO model unavailable: %s – using Classical CV fallback", exc)
            self._available = False

    @property
    def available(self) -> bool:
        return self._available

    def detect_water_mask(self, img_bgr: np.ndarray) -> Tuple[np.ndarray, float]:
        if not self._available or self._model is None:
            raise RuntimeError("YOLO model is not initialized.")

        resized = cv2.resize(img_bgr, (CANVAS_WIDTH, CANVAS_HEIGHT), interpolation=cv2.INTER_AREA)
        results = self._model(resized, verbose=False)

        mask = np.zeros((CANVAS_HEIGHT, CANVAS_WIDTH), dtype=np.uint8)
        max_conf = 0.0

        if results and len(results) > 0 and results[0].masks is not None:
            for r_mask, box in zip(results[0].masks.data, results[0].boxes):
                m_np = (r_mask.cpu().numpy() * 255).astype(np.uint8)
                m_resized = cv2.resize(m_np, (CANVAS_WIDTH, CANVAS_HEIGHT), interpolation=cv2.NEAREST)
                mask = cv2.bitwise_or(mask, m_resized)
                max_conf = max(max_conf, float(box.conf.item()))

        confidence = max_conf if max_conf > 0 else 0.70
        return mask, confidence


# ---------------------------------------------------------------------------
# Visualization Generator
# ---------------------------------------------------------------------------

def _generate_hazard_visualization(
    img_before: np.ndarray,
    mask_before: np.ndarray,
    img_after: np.ndarray,
    mask_after: np.ndarray,
    output_path: str,
    reduction_pct: float,
) -> str:
    """
    Generates side-by-side visualization showing BEFORE + hazard mask vs AFTER + hazard mask.
    Saves image to output_path and returns absolute path.
    """
    b_res = cv2.resize(img_before, (CANVAS_WIDTH, CANVAS_HEIGHT))
    a_res = cv2.resize(img_after, (CANVAS_WIDTH, CANVAS_HEIGHT))

    # Overlay mask in RED/ORANGE transparent color (0, 64, 255)
    overlay_b = b_res.copy()
    overlay_a = a_res.copy()

    overlay_b[mask_before > 0] = [0, 64, 255]
    overlay_a[mask_after > 0] = [0, 200, 0]  # Green overlay for post-remediation area

    b_blended = cv2.addWeighted(b_res, 0.65, overlay_b, 0.35, 0)
    a_blended = cv2.addWeighted(a_res, 0.65, overlay_a, 0.35, 0)

    # Draw contour outlines
    cnts_b, _ = cv2.findContours(mask_before, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(b_blended, cnts_b, -1, (0, 0, 255), 2)

    cnts_a, _ = cv2.findContours(mask_after, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    cv2.drawContours(a_blended, cnts_a, -1, (0, 255, 0), 2)

    # Add descriptive text headers
    cv2.putText(b_blended, f"BEFORE (Hazard Area: {int(np.sum(mask_before > 0))} px)", (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    cv2.putText(a_blended, f"AFTER (Hazard Area: {int(np.sum(mask_after > 0))} px)", (15, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
    cv2.putText(a_blended, f"Visual hazard reduction: {reduction_pct:.1f}%", (15, 60),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 255, 255), 2)

    # Side-by-side panel concatenation
    combined = np.hstack([b_blended, a_blended])

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, combined)
    return output_path


# ---------------------------------------------------------------------------
# Public Service Interface
# ---------------------------------------------------------------------------

class HazardDetectionService:
    """
    High-level Hazard Change Engine service.

    Usage::

        svc = HazardDetectionService()
        result = svc.analyze(before_img, after_img)
    """

    def __init__(self):
        self._yolo_detector = _YOLOHazardDetector()
        self._classical_detector = _ClassicalWaterDetector()
        self._road_defect_detector = _ClassicalRoadDefectDetector()
        self._garbage_detector = _ClassicalGarbageDetector()

        if self._yolo_detector.available:
            logger.info("[HazardDetectionService] Primary engine: YOLO Segmentation")
        else:
            logger.info("[HazardDetectionService] Primary engine unavailable – using Classical CV fallback")

    # ---- Internal helpers ------------------------------------------------

    @staticmethod
    def _load_image(path_or_bytes) -> np.ndarray:
        if isinstance(path_or_bytes, bytes):
            arr = np.frombuffer(path_or_bytes, dtype=np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        elif isinstance(path_or_bytes, str):
            img = cv2.imread(path_or_bytes, cv2.IMREAD_COLOR)
        elif isinstance(path_or_bytes, np.ndarray):
            img = path_or_bytes
        else:
            raise ValueError(f"Unsupported image input type: {type(path_or_bytes)}")

        if img is None or img.size == 0:
            raise ValueError("Could not decode image payload – file may be corrupt or missing.")
        return img

    # ---- Public API ------------------------------------------------------

    def analyze(
        self,
        before_image,
        after_image,
        hazard_type: str = "STAGNANT_WATER",
        visualization_dir: Optional[str] = None,
        session_id: Optional[str] = None,
        is_scene_verifiable: bool = True,
    ) -> HazardAnalysisResult:
        """
        Run the hazard change engine on a BEFORE / AFTER image pair with category-specific logic.
        """
        t0 = time.perf_counter()

        # If scene or location is not verified as matching original complaint:
        if not is_scene_verifiable:
            elapsed = round((time.perf_counter() - t0) * 1000, 1)
            reason = "HAZARD CHANGE UNVERIFIABLE: Worker evidence does not correspond sufficiently to the original reported scene."
            signals = [
                {"signal_name": "hazard_type", "signal_value": hazard_type, "confidence": 1.0},
                {"signal_name": "hazard_status", "signal_value": "UNVERIFIABLE", "confidence": 1.0},
                {"signal_name": "hazard_reduction_percentage", "signal_value": "UNVERIFIABLE", "confidence": 0.0},
                {"signal_name": "hazard_resolution_score", "signal_value": "0.0", "confidence": 0.0},
                {"signal_name": "requires_human_review", "signal_value": "True", "confidence": 1.0},
                {"signal_name": "human_review_reason", "signal_value": reason, "confidence": 1.0},
            ]
            return HazardAnalysisResult(
                hazard_type=hazard_type,
                before_hazard_area=0,
                after_hazard_area=0,
                hazard_reduction_percentage=0.0,
                hazard_resolution_score=0.0,
                confidence=0.0,
                method_used="UNVERIFIABLE_SCENE_MISMATCH",
                inference_time_ms=elapsed,
                requires_human_review=True,
                review_reason=reason,
                signals=signals,
            )

        # 1. Load images
        try:
            img_b = self._load_image(before_image)
            img_a = self._load_image(after_image)
        except Exception as exc:
            logger.error("[HazardEngine] Image load failed: %s", exc)
            return HazardAnalysisResult(
                hazard_type=hazard_type,
                error=str(exc),
                requires_human_review=True,
                review_reason=f"Image load failure: {str(exc)}",
            )

        # 2. Run category-specific detection pipeline
        h_norm = hazard_type.upper()
        is_road_defect = h_norm in ("ROAD_DEFECT", "POTHOLE", "ROAD_DAMAGE")
        is_garbage = h_norm in ("GARBAGE", "SOLID_WASTE", "GARBAGE_DUMP", "LITTER")
        is_water = h_norm in ("STAGNANT_WATER", "WATER_ACCUMULATION", "DRAINAGE_OVERFLOW", "WATER_LOGGING")
        is_manual_category = h_norm in ("BROKEN_STREETLIGHT", "STREETLIGHT_OUTAGE", "ELECTRICAL_FAULT", "OTHER")

        if is_manual_category:
            elapsed = round((time.perf_counter() - t0) * 1000, 1)
            reason = f"Category '{hazard_type}' requires manual auditor review for infrastructure verification."
            signals = [
                {"signal_name": "hazard_type", "signal_value": hazard_type, "confidence": 1.0},
                {"signal_name": "hazard_status", "signal_value": "MANUAL_REVIEW_REQUIRED", "confidence": 0.80},
                {"signal_name": "hazard_reduction_percentage", "signal_value": "N/A", "confidence": 0.0},
                {"signal_name": "hazard_resolution_score", "signal_value": "50.0", "confidence": 0.50},
                {"signal_name": "requires_human_review", "signal_value": "True", "confidence": 1.0},
                {"signal_name": "human_review_reason", "signal_value": reason, "confidence": 1.0},
            ]
            return HazardAnalysisResult(
                hazard_type=hazard_type,
                before_hazard_area=0,
                after_hazard_area=0,
                hazard_reduction_percentage=0.0,
                hazard_resolution_score=50.0,
                confidence=0.50,
                method_used="MANUAL_REVIEW_REQUIRED",
                inference_time_ms=elapsed,
                requires_human_review=True,
                review_reason=reason,
                signals=signals,
            )

        if is_road_defect:
            mask_b, conf_b = self._road_defect_detector.detect_defect_mask(img_b)
            mask_a, conf_a = self._road_defect_detector.detect_defect_mask(img_a)
            method_used = "CLASSICAL_CV_ROAD_DEFECT"
        elif is_garbage:
            mask_b, conf_b = self._garbage_detector.detect_garbage_mask(img_b)
            mask_a, conf_a = self._garbage_detector.detect_garbage_mask(img_a)
            method_used = "CLASSICAL_CV_SOLID_WASTE"
        elif is_water and self._yolo_detector.available:
            try:
                mask_b, conf_b = self._yolo_detector.detect_water_mask(img_b)
                mask_a, conf_a = self._yolo_detector.detect_water_mask(img_a)
                method_used = "YOLO_SEGMENTATION"
            except Exception as exc:
                logger.warning("[HazardEngine] YOLO detection failed: %s – using Classical CV fallback", exc)
                mask_b, conf_b = self._classical_detector.detect_water_mask(img_b)
                mask_a, conf_a = self._classical_detector.detect_water_mask(img_a)
                method_used = "CLASSICAL_CV_STAGNANT_WATER_FALLBACK"
        else:
            mask_b, conf_b = self._classical_detector.detect_water_mask(img_b)
            mask_a, conf_a = self._classical_detector.detect_water_mask(img_a)
            method_used = "CLASSICAL_CV_STAGNANT_WATER_FALLBACK"

        area_b = int(np.sum(mask_b > 0))
        area_a = int(np.sum(mask_a > 0))

        # 3. Calculate Visual Hazard Reduction Percentage
        if area_b > 0:
            reduction_pct = max(0.0, ((area_b - area_a) / float(area_b)) * 100.0)
        else:
            reduction_pct = 0.0

        resolution_score = min(100.0, round(reduction_pct, 2))
        avg_confidence = round((conf_b + conf_a) / 2.0, 2)
        elapsed = round((time.perf_counter() - t0) * 1000, 1)

        # 4. Category-Specific Human Review Routing Evaluation
        requires_review = False
        review_reason = None

        min_area_thresh = 150 if is_road_defect else 200
        if area_b < min_area_thresh:
            requires_review = True
            review_reason = f"No significant {hazard_type.lower().replace('_', ' ')} detected in BEFORE complaint image (area < {min_area_thresh} px)."
        elif avg_confidence < 0.40:
            requires_review = True
            review_reason = f"Low detection confidence ({avg_confidence:.2f} < 0.40)."
        elif area_a > area_b * 1.25:
            requires_review = True
            review_reason = f"Hazard defect area increased in post-verification image ({area_a} px > {area_b} px)."

        # 5. Generate Visualization
        viz_path = None
        if visualization_dir:
            try:
                fname = f"hazard_change_{session_id or 'unknown'}.png"
                target_path = os.path.join(visualization_dir, fname)
                viz_path = _generate_hazard_visualization(
                    img_b, mask_b, img_a, mask_a, target_path, reduction_pct
                )
            except Exception as exc:
                logger.warning("[HazardEngine] Visualization generation failed: %s", exc)

        # 6. Build Verification Signals
        signals = [
            {"signal_name": "hazard_type", "signal_value": hazard_type, "confidence": 1.0},
            {"signal_name": "before_hazard_area_px", "signal_value": str(area_b), "confidence": conf_b},
            {"signal_name": "after_hazard_area_px", "signal_value": str(area_a), "confidence": conf_a},
            {"signal_name": "hazard_reduction_percentage", "signal_value": f"{reduction_pct:.2f}%", "confidence": avg_confidence},
            {"signal_name": "hazard_resolution_score", "signal_value": str(resolution_score), "confidence": avg_confidence},
            {"signal_name": "hazard_method_used", "signal_value": method_used, "confidence": 1.0},
            {"signal_name": "hazard_inference_time_ms", "signal_value": str(elapsed), "confidence": 1.0},
            {"signal_name": "requires_human_review", "signal_value": str(requires_review), "confidence": 1.0},
        ]
        if review_reason:
            signals.append({"signal_name": "human_review_reason", "signal_value": review_reason, "confidence": 1.0})

        logger.info(
            "[HazardEngine] Analysis complete | method=%s before_px=%d after_px=%d reduction=%.1f%% score=%.1f review=%s",
            method_used, area_b, area_a, reduction_pct, resolution_score, requires_review
        )

        return HazardAnalysisResult(
            hazard_type=hazard_type,
            before_hazard_area=area_b,
            after_hazard_area=area_a,
            hazard_reduction_percentage=round(reduction_pct, 2),
            hazard_resolution_score=resolution_score,
            confidence=avg_confidence,
            method_used=method_used,
            inference_time_ms=elapsed,
            requires_human_review=requires_review,
            review_reason=review_reason,
            visualization_path=viz_path,
            signals=signals,
        )


# ---------------------------------------------------------------------------
# Module-level singleton instance
# ---------------------------------------------------------------------------

_hazard_service_instance: Optional[HazardDetectionService] = None


def get_hazard_detection_service() -> HazardDetectionService:
    """Returns the singleton HazardDetectionService instance."""
    global _hazard_service_instance
    if _hazard_service_instance is None:
        _hazard_service_instance = HazardDetectionService()
    return _hazard_service_instance
