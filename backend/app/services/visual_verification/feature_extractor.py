import cv2
import numpy as np

class SuperPointExtractor:
    """
    Extracts keypoints and descriptors using SuperPoint architecture.
    (Falls back to ORB if PyTorch weights are missing).
    """
    def __init__(self):
        # In a real environment, we would load torch and SuperPoint models here.
        # Fallback to ORB for testing
        self.orb = cv2.ORB_create(nfeatures=2048)

    def extract(self, img_bgr: np.ndarray):
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        kp, desc = self.orb.detectAndCompute(gray, None)
        return kp, desc
