"""
Configurable parameters for Visual Verification Module.
Includes SuperPoint/SuperGlue and RANSAC thresholds.
"""

VISUAL_VERIFICATION_CONFIG = {
    "SUPERGLUE_MATCH_THRESHOLD": 0.85,
    "MIN_RANSAC_INLIERS": 6,
    "MIN_INLIER_RATIO": 0.05,
    "MAX_GEOMETRIC_ERROR": 8.0, # pixel reprojection error limit
}
