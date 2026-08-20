# MEIKAAN — Technical Status & Architecture Audit Report

**System Name**: MEIKAAN (AI-Powered Civic Evidence Integrity & Work Verification Engine)  
**Evaluation Scope**: Verification pipeline correctness, spatial-temporal gating, anti-replay protections, and test integrity.  
**Audited Target**: Backend Services (`FastAPI`), Forensic Vision Pipeline (`OpenCV`), and Frontend Portals (`React + Vite`).

---

## 1. Executive Summary & Verification Metrics

MEIKAAN verifies whether municipal field-work closure evidence (AFTER photo + GPS metadata) reliably supports the resolution of an initial citizen grievance (BEFORE photo + GPS metadata).

### Test Suite Execution Summary
- **Test Framework**: `pytest 9.1.1` (Python 3.11.5)
- **Total Test Files**: `24` test suites in `backend/tests/`
- **Total Tests Collected**: `148`
- **Passed**: `146`
- **Skipped**: `2` (`tests/test_scene_verification.py:276` and `tests/test_scene_verification.py:293` due to test database admin token fixture dependencies)
- **Failed**: `0`

---

## 2. Decision Logic & Thresholds (As Implemented)

The Evidence Fusion Engine (`app/services/integrity_scoring.py`) combines 7 constituent signals into an explainable decision. It separates mathematical **Score ($0.0 - 100.0$)** from **Confidence ($0.0 - 1.0$)**.

### Component Weights
| Component | Weight | Implementation Details |
| :--- | :--- | :--- |
| **Hazard Resolution** | `30%` | Morphological cavity gradient & water segmentation mask reduction. |
| **Scene Consistency** | `20%` | CLAHE-enhanced multi-scale ORB feature matching with RANSAC homography. |
| **Live Capture** | `15%` | WebRTC live camera vs. gallery file upload origin validation. |
| **Spatial Proximity** | `10%` | Haversine distance evaluated against dynamic device accuracy bounds. |
| **Temporal Velocity** | `10%` | Inter-task velocity checks ($>100\text{ km/h}$ flags spatio-temporal anomaly). |
| **Freshness / Anti-Replay** | `10%` | SHA-256 collision check across tickets + citizen BEFORE reuse prevention. |
| **Evidence Quality** | `5%` | Laplacian variance blur detection, luminance, and aspect ratio checks. |

### Decision Rules
- **`CLOSURE_NOT_VERIFIED`**:
  - Exact duplicate reuse across different tickets, or spatio-temporal velocity anomaly $\implies$ Score: `0.0`, Confidence: `0.95`.
  - Location mismatch ($\text{distance} > \text{tolerance} + \text{margin}$) $\implies$ Score: $\le 15.0$, Confidence: `0.95`.
  - Scene mismatch (RANSAC inlier ratio below threshold) $\implies$ Score: $\le 15.0$, Confidence: `0.90`.
  - Civic hazard still present (hazard reduction $< 25.0\%$) $\implies$ Score capped at `25.0`.
- **`HUMAN_REVIEW`**:
  - Missing, corrupted, or unreadable evidence image payloads $\implies$ Score: `40.0`, Confidence: `0.50`.
  - Manual-review grievance categories (e.g. `BROKEN_STREETLIGHT`, `ELECTRICAL_FAULT`, `OTHER`).
  - Partial hazard resolution ($25.0\% \le \text{hazard reduction} < 50.0\%$).
  - Uncertain scene correspondence (borderline inliers).
  - Location signal approximate or unavailable when scene match is unconfirmed.
  - Quality flags triggered (severe blur, extreme glare/underexposure).
  - System or parsing exceptions encountered during execution.
- **`VERIFIED`**:
  - Location matches complaint site (`GPS_PASS` or `GPS_BORDERLINE`), visual scene confirmed (`STRONG_MATCH` or `WEAK_MATCH`), and civic hazard resolved ($\ge 50.0\%$ reduction or smooth asphalt cavity fill) $\implies$ Score: weighted sum ($\ge 80.0$), Confidence: $\ge 0.85$.

---

## 3. Technology Stack & Implementation Reality

### Visual Scene Verification
- **Currently Running**: High-capacity multi-scale **OpenCV ORB (5,000 features)** with **CLAHE local contrast enhancement**, **BFMatcher (Hamming distance with Lowe's ratio test)**, and **RANSAC geometric verification** (homography estimation, convex-hull spatial coverage, and reprojection error).
- **Rationale**: Provides deterministic, ultra-fast CPU inference ($<80\text{ms}$) without requiring heavy PyTorch GPU dependencies during local hackathon/civic field deployment.
- **Architectural Targets (Interfaces Structured)**: Deep feature extractors and neural matchers (SuperPoint, SuperGlue, LightGlue, LoFTR) have modular class interfaces in `app/services/visual_verification/`, intended for server environments with dedicated GPU acceleration.

### Hazard & Cavity Detection
- **Potholes / Road Defect**: Classical morphological Blackhat top-hat filtering combined with Sobel gradient magnitude to segment dark cavity depressions and compare structural defect area before and after repair.
- **Stagnant Water**: Multi-channel color space thresholding (HSV/Lab) to compute water puddle surface reflection masks.
- **Solid Waste / Garbage**: Color dispersion and texture entropy ratio.

---

## 4. Current Status: What Is Working vs. Partial vs. Gaps

### Fully Implemented & Verified
1. **Authoritative GPS Decision Pipeline**:
   - Single authoritative backend distance calculation: $\text{tolerance} = \max(\text{threshold}, \text{ticket\_accuracy} + \text{evidence\_accuracy})$.
   - Clean non-contradictory statuses (`GPS_PASS`, `GPS_BORDERLINE`, `GPS_MISMATCH`, `GPS_UNAVAILABLE`).
   - Clear UI telemetry separating distance from device precision.
2. **Pothole Repair Verification (Where vs. What)**:
   - Evaluates scene background consistency independently from defect cavity disappearance.
   - Successfully verifies smooth asphalt patches without penalizing the absence of the defect.
3. **Cryptographic Anti-Replay & Freshness**:
   - Blocks cross-complaint image reuse (SHA-256 match on another ticket).
   - Blocks workers submitting citizen's BEFORE photo as proof of closure.
   - Permits same-worker retries and task reopen workflows.
4. **Live WebRTC Camera & Geolocation**:
   - Direct camera access with front/back toggle, photo preview, retake, and browser geolocation capture.
5. **Auditor Split-View & Governance Queue**:
   - Interactive comparison slider with zoom/inversion filters, approval, reverification requests, and audit logging.

### Partially Working / Graceful Degradations
1. **EXIF Metadata Capture**: Web browsers frequently strip EXIF metadata from file uploads or canvas snapshots. The engine handles missing EXIF gracefully by assigning low confidence rather than false-flagging workers as fraudulent.
2. **Cellular/Network GPS Jitter**: When GPS accuracy is wide ($\pm 100\text{m}-250\text{m}$), the system widens the tolerance window and leans heavily on visual scene correspondence.

### Known Limitations
1. **Extreme Perspective Changes**: Camera angle differences $> 60^\circ$ pitch/yaw between BEFORE and AFTER images reduce 2D homography inliers; these cases safely route to `HUMAN_REVIEW`.
2. **Night-Time / Poor Lighting**: Images captured in severe darkness or with direct flash glare lack sufficient ambient contrast for keypoint extraction and route to `HUMAN_REVIEW`.
3. **Non-Visual Civic Hazards**: Electrical hazards, streetlights, and sanitation odors cannot be verified visually and are routed to human reviewers by design.

---

## 5. Security & Deployment Posture

- **Authentication**: JWT bearer tokens with role-based access control (Admin, Worker, Reviewer, Citizen). Passwords hashed using bcrypt.
- **Demo Seed Credentials**: Relocated to `DEMO_CREDENTIALS.md` with explicit notice that they are local development seed accounts.
- **Cross-Platform Startup**: `start_project.py` handles venv activation, dependency checks, database seeding, and frontend launching across Windows, macOS, and Linux.
