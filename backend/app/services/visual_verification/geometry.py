import cv2
import numpy as np
from . import VISUAL_VERIFICATION_CONFIG

class GeometricVerifier:
    def __init__(self):
        self.min_inliers = VISUAL_VERIFICATION_CONFIG["MIN_RANSAC_INLIERS"]
        self.min_inlier_ratio = VISUAL_VERIFICATION_CONFIG["MIN_INLIER_RATIO"]
        self.max_error = VISUAL_VERIFICATION_CONFIG["MAX_GEOMETRIC_ERROR"]

    def verify(self, pts1: list, pts2: list, img_shape: tuple):
        """
        Applies RANSAC to filter outliers and evaluate spatial coverage.
        """
        if len(pts1) < 4 or len(pts2) < 4:
            return {
                "inliers": 0,
                "inlier_ratio": 0.0,
                "geometric_error": 0.0,
                "spatial_coverage": 0.0,
                "status": "DIFFERENT_SCENE",
                "H": None,
                "mask": None
            }

        np_pts1 = np.float32(pts1).reshape(-1, 1, 2)
        np_pts2 = np.float32(pts2).reshape(-1, 1, 2)

        # Adaptive RANSAC threshold based on image dimensions
        img_diag = np.sqrt(img_shape[0]**2 + img_shape[1]**2) if len(img_shape) >= 2 else 1000.0
        ransac_thresh = max(self.max_error, img_diag * 0.035)

        # Find homography with RANSAC
        H, mask = cv2.findHomography(np_pts1, np_pts2, cv2.RANSAC, ransac_thresh)
        
        if H is None or mask is None:
            return {
                "inliers": 0,
                "inlier_ratio": 0.0,
                "geometric_error": 0.0,
                "spatial_coverage": 0.0,
                "status": "DIFFERENT_SCENE",
                "H": None,
                "mask": None
            }

        inliers_count = int(np.sum(mask))
        total_matches = len(pts1)
        inlier_ratio = inliers_count / total_matches if total_matches > 0 else 0.0

        # Calculate geometric error (mean reprojection error of inliers)
        geometric_error = 0.0
        if inliers_count > 0:
            pts1_inliers = np_pts1[mask.ravel() == 1]
            pts2_inliers = np_pts2[mask.ravel() == 1]
            
            # Reproject pts1 to pts2 using H
            pts1_reproj = cv2.perspectiveTransform(pts1_inliers, H)
            
            # Calculate distance between reprojected points and actual points
            errors = np.linalg.norm(pts1_reproj - pts2_inliers, axis=2)
            geometric_error = float(np.mean(errors))

        # Calculate spatial coverage of inliers in the images (convex hull area ratio)
        spatial_coverage = 0.0
        if inliers_count >= 3:
            pts1_inliers_2d = pts1_inliers.reshape(-1, 2)
            try:
                hull = cv2.convexHull(pts1_inliers_2d)
                hull_area = cv2.contourArea(hull)
                img_area = img_shape[0] * img_shape[1]
                spatial_coverage = min(1.0, hull_area / img_area)
            except Exception:
                spatial_coverage = 0.0

        # Evaluate Status based on thresholds
        # Legitimate before/after photographs with lighting/perspective variation
        if inliers_count >= 6 and (inlier_ratio >= 0.04 or inliers_count >= 8):
            status = "STRONG_MATCH"
        elif inliers_count >= 4 and (inlier_ratio >= 0.03 or inliers_count >= 5):
            status = "WEAK_MATCH"
        elif inliers_count >= 3:
            status = "UNCERTAIN"
        else:
            status = "DIFFERENT_SCENE"

        return {
            "inliers": inliers_count,
            "inlier_ratio": round(inlier_ratio, 4),
            "geometric_error": round(geometric_error, 2),
            "spatial_coverage": round(spatial_coverage, 4),
            "status": status,
            "H": H,
            "mask": mask
        }
