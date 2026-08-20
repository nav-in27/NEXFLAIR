import cv2
import numpy as np

class SuperPointExtractor:
    """
    Extracts keypoints and descriptors using SuperPoint / enhanced multi-scale feature extractor.
    Captures persistent environmental landmarks (road edges, lane markings, curbs, trees, buildings).
    """
    def __init__(self):
        self.orb = cv2.ORB_create(nfeatures=5000, scaleFactor=1.2, nlevels=8, edgeThreshold=15)

    def extract(self, img_bgr: np.ndarray):
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        # Apply CLAHE to equalize local contrast across varying outdoor lighting
        clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(gray)
        kp, desc = self.orb.detectAndCompute(enhanced, None)
        return kp, desc
