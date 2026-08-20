"""
MEIKAAN Evidence Quality Engine
================================
Evaluates image fidelity parameters:
- Resolution (width, height, total pixels)
- Blur (Laplacian variance)
- Brightness / Darkness (mean luminance)
- Camera obstruction / Occlusion (finger/lens cover detection)
- Excessive cropping / aspect ratio anomaly

IMPORTANT:
- Low visual quality does NOT imply suspicious or malicious intent.
- Poor quality flags trigger HUMAN_REVIEW_REQUIRED for manual inspection.
- Deterministic scoring without fake data.
"""

import os
import time
import logging
from dataclasses import dataclass, field
from typing import Optional, List, Tuple

import cv2
import numpy as np

logger = logging.getLogger("meikaan.quality_service")

# Quality Threshold Constants
MIN_WIDTH_PX = 480
MIN_HEIGHT_PX = 360
BLUR_LAPLACIAN_THRESH = 100.0  # Laplacian variance < 100 indicates blur
TOO_DARK_MEAN_THRESH = 40.0    # Mean brightness < 40 indicates underexposure/darkness
TOO_BRIGHT_MEAN_THRESH = 230.0 # Mean brightness > 230 indicates overexposure/glare
OBSTRUCTION_UNIFORM_THRESH = 0.85 # >85% of pixels uniform indicates camera obstruction


@dataclass
class QualityAnalysisResult:
    """Immutable result from Evidence Quality Analysis."""
    quality_score: float = 100.0
    quality_flags: List[str] = field(default_factory=list)
    explanation: str = "Evidence image meets all visual quality standards."
    human_review_required: bool = False
    review_reason: Optional[str] = None
    width: int = 0
    height: int = 0
    blur_score: float = 0.0
    brightness_score: float = 0.0
    inference_time_ms: float = 0.0
    signals: List[dict] = field(default_factory=list)


class EvidenceQualityService:
    """
    Evidence Quality Analysis Service.
    Evaluates image resolution, focus/blur, exposure, and occlusion.
    """

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
            raise ValueError("Could not decode image payload – file may be corrupt or unreadable.")
        return img

    def analyze(self, image_input) -> QualityAnalysisResult:
        """
        Runs complete visual quality assessment on an image input.
        """
        t0 = time.perf_counter()

        try:
            img_bgr = self._load_image(image_input)
        except Exception as exc:
            logger.error("[QualityService] Image load failed: %s", exc)
            return QualityAnalysisResult(
                quality_score=0.0,
                quality_flags=["CORRUPT_OR_UNREADABLE"],
                explanation=f"Image quality failure: {str(exc)}",
                human_review_required=True,
                review_reason=f"Corrupt or unreadable image file: {str(exc)}",
            )

        h, w = img_bgr.shape[:2]
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)

        flags = []
        deductions = 0.0

        # 1. Resolution Check
        if w < MIN_WIDTH_PX or h < MIN_HEIGHT_PX:
            flags.append("LOW_RESOLUTION")
            deductions += 25.0

        # 2. Blur / Sharpness Analysis (Laplacian Variance)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        if laplacian_var < BLUR_LAPLACIAN_THRESH:
            flags.append("BLURRY")
            # Proportional deduction based on severity of blur
            blur_deduction = max(15.0, 40.0 * (1.0 - (laplacian_var / BLUR_LAPLACIAN_THRESH)))
            deductions += blur_deduction

        # 3. Brightness / Exposure Analysis
        mean_brightness = float(np.mean(gray))
        if mean_brightness < TOO_DARK_MEAN_THRESH:
            flags.append("TOO_DARK")
            deductions += 30.0
        elif mean_brightness > TOO_BRIGHT_MEAN_THRESH:
            flags.append("OVEREXPOSED")
            deductions += 20.0

        # 4. Camera Obstruction / Occlusion Check (Finger over lens or lens cap)
        # Check standard deviation of gray channel – zero/very low std indicates solid cover
        gray_std = float(np.std(gray))
        hist = cv2.calcHist([gray], [0], None, [256], [0, 256])
        max_bin_count = float(np.max(hist))
        total_pixels = float(w * h)

        if (max_bin_count / total_pixels) > OBSTRUCTION_UNIFORM_THRESH or gray_std < 10.0:
            flags.append("CAMERA_OBSTRUCTED")
            deductions += 50.0

        # 5. Aspect Ratio / Heavy Cropping Check
        aspect_ratio = max(w / max(1, h), h / max(1, w))
        if aspect_ratio > 3.0:  # Extreme banner/strip crop
            flags.append("EXCESSIVE_CROPPING")
            deductions += 20.0

        # Calculate final quality score
        quality_score = round(max(0.0, min(100.0, 100.0 - deductions)), 1)
        human_review_required = len(flags) > 0 or quality_score < 70.0

        if flags:
            explanation = f"Quality flags identified: {', '.join(flags)}. Visual quality insufficient for automated verification."
            review_reason = f"HUMAN_REVIEW_REQUIRED: Quality flags ({', '.join(flags)}) detected (Score: {quality_score}/100)."
        else:
            explanation = "Evidence image meets all visual quality standards."
            review_reason = None

        elapsed_ms = round((time.perf_counter() - t0) * 1000.0, 1)

        # Build signals
        signals = [
            {"signal_name": "quality_score", "signal_value": str(quality_score), "confidence": 1.0},
            {"signal_name": "quality_flags", "signal_value": ",".join(flags) if flags else "NONE", "confidence": 1.0},
            {"signal_name": "resolution_width_px", "signal_value": str(w), "confidence": 1.0},
            {"signal_name": "resolution_height_px", "signal_value": str(h), "confidence": 1.0},
            {"signal_name": "blur_laplacian_variance", "signal_value": str(round(laplacian_var, 1)), "confidence": 1.0},
            {"signal_name": "mean_brightness", "signal_value": str(round(mean_brightness, 1)), "confidence": 1.0},
            {"signal_name": "human_review_required", "signal_value": str(human_review_required), "confidence": 1.0},
            {"signal_name": "quality_explanation", "signal_value": explanation, "confidence": 1.0},
            {"signal_name": "quality_inference_time_ms", "signal_value": str(elapsed_ms), "confidence": 1.0},
        ]

        logger.info(
            "[QualityService] Assessment complete | score=%.1f flags=%s review=%s ms=%.1f",
            quality_score, flags, human_review_required, elapsed_ms
        )

        return QualityAnalysisResult(
            quality_score=quality_score,
            quality_flags=flags,
            explanation=explanation,
            human_review_required=human_review_required,
            review_reason=review_reason,
            width=w,
            height=h,
            blur_score=round(laplacian_var, 1),
            brightness_score=round(mean_brightness, 1),
            inference_time_ms=elapsed_ms,
            signals=signals,
        )


# Singleton Instance
_quality_service_instance: Optional[EvidenceQualityService] = None

def get_evidence_quality_service() -> EvidenceQualityService:
    """Returns singleton EvidenceQualityService instance."""
    global _quality_service_instance
    if _quality_service_instance is None:
        _quality_service_instance = EvidenceQualityService()
    return _quality_service_instance
