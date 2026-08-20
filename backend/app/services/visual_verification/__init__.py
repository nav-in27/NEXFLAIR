"""
Configurable parameters for Visual Verification Module.
Includes SuperPoint/SuperGlue and RANSAC thresholds.
"""

VISUAL_VERIFICATION_CONFIG = {
    "SUPERGLUE_MATCH_THRESHOLD": 0.7,
    "MIN_RANSAC_INLIERS": 15,
    "MIN_INLIER_RATIO": 0.15,
    "MAX_GEOMETRIC_ERROR": 5.0, # pixel reprojection error limit
}
