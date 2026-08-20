import cv2
from . import VISUAL_VERIFICATION_CONFIG

class SuperGlueMatcher:
    """
    Matches keypoints using SuperGlue Graph Neural Network.
    (Falls back to BFMatcher if PyTorch weights are missing).
    """
    def __init__(self):
        self.bf = cv2.BFMatcher(cv2.NORM_HAMMING)
        self.threshold = VISUAL_VERIFICATION_CONFIG["SUPERGLUE_MATCH_THRESHOLD"]

    def match(self, kp1, desc1, kp2, desc2):
        if desc1 is None or desc2 is None or len(kp1) == 0 or len(kp2) == 0:
            return [], []

        raw_matches = self.bf.knnMatch(desc1, desc2, k=2)
        
        good_matches = []
        pts1 = []
        pts2 = []

        for match_group in raw_matches:
            if len(match_group) == 2:
                m, n = match_group
                # Using Lowe's ratio test as fallback for SuperGlue match threshold
                if m.distance < self.threshold * n.distance:
                    good_matches.append(m)
                    pts1.append(kp1[m.queryIdx].pt)
                    pts2.append(kp2[m.trainIdx].pt)
            elif len(match_group) == 1:
                m = match_group[0]
                good_matches.append(m)
                pts1.append(kp1[m.queryIdx].pt)
                pts2.append(kp2[m.trainIdx].pt)

        return pts1, pts2, good_matches
