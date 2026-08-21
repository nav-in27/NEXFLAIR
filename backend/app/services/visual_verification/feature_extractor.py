import cv2
import numpy as np

class SuperPointExtractor:
    """
    Extracts keypoints and descriptors using multi-scale feature extractor.
    Captures persistent environmental landmarks (road edges, lane markings, curbs, trees, buildings).
    """
    def __init__(self, max_dim: int = 800):
        self.max_dim = max_dim
        self.orb = cv2.ORB_create(nfeatures=5000, scaleFactor=1.2, nlevels=8, edgeThreshold=15)

    def extract(self, img_bgr: np.ndarray):
        h, w = img_bgr.shape[:2]
        if max(h, w) > self.max_dim:
            scale = self.max_dim / max(h, w)
            img_working = cv2.resize(img_bgr, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        else:
            img_working = img_bgr

        gray = cv2.cvtColor(img_working, cv2.COLOR_BGR2GRAY)
        # Apply CLAHE to equalize local contrast across varying outdoor lighting
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        kp, desc = self.orb.detectAndCompute(enhanced, None)
        return kp, desc

