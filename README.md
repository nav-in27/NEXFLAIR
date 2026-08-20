# MEIKAAN — AI-Powered Civic Evidence Integrity & Work Verification Engine

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.2-61DAFB.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Pytest](https://img.shields.io/badge/pytest-146%20passed%20%7C%202%20skipped-brightgreen.svg)](https://pytest.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MEIKAAN** is a high-reliability civic governance platform that connects citizen grievance reporting with tamper-proof, computer-vision-verified field worker task resolution.

Municipalities frequently encounter "ghost closures" (tickets marked resolved without field visits or genuine repairs), recycled photos, and contradictory GPS coordinates. MEIKAAN replaces manual guesswork with a multi-layered cryptographic, spatial, and computer vision forensic verification pipeline.

<!-- TODO: Insert Hero Demo GIF / Screenshot here -->
<!-- ![MEIKAAN Demo Overview](docs/images/meikaan_hero_demo.gif) -->

---

## ⚠️ Known Limitations & Operational Constraints

1. **Camera Perspective Bounds**: Scene correspondence requires overlapping physical background features. Extreme angle differences ($>60^\circ$ pitch/yaw offset between BEFORE and AFTER photos) reduce 2D planar inliers and safely route the case to `HUMAN_REVIEW`.
2. **Night-Time & Extreme Glare**: Images captured in pitch darkness, heavy shadow occlusions, or with direct camera flash glare lack sufficient local contrast for keypoint extraction and are sent to human auditors.
3. **Non-Visual Hazard Types**: Electrical failures, broken streetlights, and sanitation odors cannot be verified purely via computer vision and are routed to manual municipal review by policy.
4. **Browser EXIF Stripping**: Mobile browsers and messaging apps frequently strip EXIF GPS/timestamps from uploaded files. MEIKAAN handles missing EXIF gracefully by relying on live camera capture or assigning lower confidence rather than falsely penalizing field workers.

---

## 🏛️ Core Architecture & Verification Engine

MEIKAAN evaluates field work resolution through a **two-part forensic evaluation pipeline**:

```
                              ┌───────────────────────────────────┐
                              │     CITIZEN REPORT (BEFORE)       │
                              │  - Photo + GPS Coordinates        │
                              │  - Automated Ward Derivation      │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │      WORKER TASK ALLOCATION       │
                              │  - Ward-Scoped Task Assignment    │
                              │  - Live Camera / Upload Evidence  │
                              └─────────────────┬─────────────────┘
                                                │
                                                ▼
               ┌─────────────────────────────────────────────────────────────────┐
               │              MEIKAAN MULTI-GATE INTEGRITY ENGINE                │
               ├────────────────────────────────┬────────────────────────────────┤
               │ 1. SPATIAL & GPS GATE          │ 2. SCENE CONSISTENCY GATE      │
               │    Authoritative haversine     │    CLAHE + multi-scale ORB     │
               │    tolerance window            │    RANSAC geometric inliers    │
               ├────────────────────────────────┼────────────────────────────────┤
               │ 3. HAZARD RESOLUTION GATE      │ 4. EVIDENCE FRESHNESS GATE     │
               │    Depth-gradient cavity       │    Cross-complaint replay test │
               │    product for road defects    │    Citizen BEFORE reuse check  │
               └────────────────────────────────┴────────────────────────────────┘
                                                │
                                                ▼
                              ┌───────────────────────────────────┐
                              │    ISOLATED SIGNAL DECISION       │
                              │  - VERIFIED (Score ≥ 80.0)        │
                              │  - HUMAN REVIEW (Audit Queue)     │
                              │  - CLOSURE NOT VERIFIED           │
                              └───────────────────────────────────┘
```

---

## 🔬 Forensic Verification Components

### 1. Scene Consistency (Visual Landmark Matching)
- **Implemented Engine**: Multi-scale **OpenCV ORB (5,000 keypoints)** with **CLAHE local contrast enhancement**, **BFMatcher (Hamming distance with Lowe's ratio test)**, and **RANSAC geometric homography verification**.
- **Execution Profile**: Lightweight, deterministic, and optimized for fast CPU inference ($<80\text{ms}$) without requiring heavy PyTorch GPU dependencies during local municipal field deployment.
- **Architectural Interfaces**: Deep learning matchers (SuperPoint / SuperGlue / LightGlue / LoFTR) have structured interfaces in `backend/app/services/visual_verification/` for GPU-accelerated server deployments.

### 2. Pothole & Cavity Resolution (Where vs. What)
- **Where vs. What Principle**: Evaluates background scene consistency independently from defect cavity reduction, ensuring successfully repaired (smooth asphalt) roads are verified without false negatives.
- **Morphological Cavity Gradient Engine**: Combines Blackhat top-hat filtering with Sobel edge boundaries to measure structural cavity depression reduction before and after repair.

### 3. Spatio-Temporal Consistency & Authoritative GPS
- **Dynamic Tolerance Window**: Uses a single authoritative formula incorporating both citizen and worker device precision:
  $$\text{tolerance} = \max(\text{threshold}, \text{ticket\_accuracy} + \text{evidence\_accuracy})$$
- **Clear Signals**: Emits clean, non-contradictory GPS statuses (`GPS_PASS`, `GPS_BORDERLINE`, `GPS_MISMATCH`, `GPS_UNAVAILABLE`).
- **Telemetry UI Separation**: Directly displays calculated distance, worker device accuracy, and allowed tolerance as separate metrics.
- **Velocity Anomaly Detection**: Flags impossible travel speeds ($>100\text{ km/h}$) between consecutive worker submissions.

### 4. Cryptographic Anti-Replay & Freshness
- **Cross-Complaint Replay Detection**: Rejects evidence payloads previously submitted on a different complaint ticket (SHA-256 hash match).
- **Citizen Before-Photo Reuse Prevention**: Blocks fraudulent workers attempting to resubmit the citizen's original complaint photo as proof of work.
- **Legitimate Worker Retries**: Permits same-worker re-uploads and task re-openings without false duplicate penalties.

---

## ⚖️ Decision Rules & Scoring Weights

The Evidence Fusion Engine (`backend/app/services/integrity_scoring.py`) fuses 7 constituent signals into an explainable score ($0.0 - 100.0$) and confidence metric ($0.0 - 1.0$):

| Signal | Weight | Purpose |
| :--- | :--- | :--- |
| **Hazard Resolution** | `30%` | Defect cavity reduction / puddle clearance |
| **Scene Consistency** | `20%` | Environmental landmark inliers (curbs, buildings, road edges) |
| **Live Capture** | `15%` | Live WebRTC camera capture vs. gallery upload |
| **Spatial Proximity** | `10%` | Haversine distance within dynamic tolerance |
| **Temporal Velocity** | `10%` | Plausible travel time between worker submissions |
| **Freshness / Replay** | `10%` | SHA-256 cross-ticket duplicate check |
| **Evidence Quality** | `5%` | Laplacian blur variance and illumination |

### Decision Outcomes
- **`VERIFIED`**: Location matches complaint site (`GPS_PASS` or `GPS_BORDERLINE`), visual scene confirmed (`STRONG_MATCH` or `WEAK_MATCH`), and civic hazard resolved ($\ge 50.0\%$ reduction or smooth asphalt cavity fill) $\implies$ Score: weighted sum ($\ge 80.0$), Confidence: $\ge 0.85$.
- **`HUMAN_REVIEW`**: Partial hazard reduction ($25.0\% \le \text{reduction} < 50.0\%$), uncertain scene correspondence, missing/corrupted photos, manual-review categories (`BROKEN_STREETLIGHT`, `ELECTRICAL_FAULT`), or quality flags.
- **`CLOSURE_NOT_VERIFIED`**: Replayed evidence, velocity anomalies, location mismatches ($>\text{tolerance}$), scene mismatches, or unaddressed hazards ($<25.0\%$ reduction).

---

## 👥 User Roles & Access

MEIKAAN provides dedicated portals for each municipal stakeholder:

- **Citizen**: Public grievance submission with live camera/photo and browser GPS; real-time ticket tracking.
- **Field Worker**: Ward-scoped task queue, live camera evidence capture with geotagging, and instant verification feedback.
- **Municipal Reviewer**: Forensic split-view slider for inspecting borderline cases, approving closures, or ordering re-inspections.
- **Administrator**: City-wide civic health metrics, ward allocations, and audit logs.

<!-- TODO: Insert Reviewer Split-View Slider Screenshot here -->
<!-- ![Forensic Reviewer Workspace](docs/images/reviewer_split_view.png) -->

> 🔑 **Test Accounts**: See [DEMO_CREDENTIALS.md](DEMO_CREDENTIALS.md) for local pre-seeded development credentials.

---

## 🚀 Quick Start

Launch the entire stack (FastAPI backend, React frontend, SQLite database seeding, and automated browser launch) with a single command:

```bash
python start_project.py
```

*Cross-platform helper scripts:*
- **Windows**: `.\start_project.bat` or `.\start_project.ps1`
- **macOS / Linux**: `./start_project.sh`

---

## 🛠️ Manual Installation & Development

### 1. Backend Setup (FastAPI + Python 3.11)

```bash
cd backend
python -m venv venv

# Windows:
.\venv\Scripts\Activate.ps1
# Linux / macOS:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```
- **API Base URL**: `http://localhost:8000`
- **Interactive Swagger Docs**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### 2. Frontend Setup (React 18 + Vite + TypeScript)

```bash
cd frontend
npm install
npm run dev
```
- **Web Portal**: `http://localhost:5173`

---

## 🧪 Automated Testing

MEIKAAN includes **148 automated tests across 24 test suites**:

```bash
cd backend
pytest -v
```

```
================ 146 passed, 2 skipped, 0 failed in 21.48s ================
```

### Key Test Suites:
- `tests/test_verification_decision_consistency.py`: Validates all 16 GPS tolerance, anti-replay, and pothole resolution scenarios.
- `tests/test_pothole_false_negative_fix.py`: Regression tests for repaired road vs. unrepaired pothole detection.
- `tests/test_camera_upload_evidence_flow.py`: Tests live camera WebRTC flow and file upload evidence pipelines.
- `tests/test_freshness.py`: Cryptographic hash uniqueness and cross-ticket duplicate detection.
- `tests/test_review_workflow.py`: Auditor review queue and governance authorization.
- `tests/test_spatial_temporal.py`: Haversine proximity calculations and spatio-temporal velocity anomaly limits.

---

## 📁 Repository Structure

```
meikaan/
├── backend/
│   ├── app/
│   │   ├── api/v1/             # REST endpoints (auth, tickets, verification, analytics)
│   │   ├── core/               # App configuration, security, JWT auth
│   │   ├── db/                 # Database engine and session management
│   │   ├── models/             # SQLAlchemy ORM models (Ticket, Evidence, VerificationSession)
│   │   ├── schemas/            # Pydantic validation schemas
│   │   └── services/           # Forensic verification engines:
│   │       ├── spatial_temporal.py       # Haversine GPS & velocity analysis
│   │       ├── freshness_service.py      # Cross-ticket anti-replay engine
│   │       ├── hazard_detection.py       # Pothole depth-gradient & water CV
│   │       ├── integrity_scoring.py      # Signal fusion & decision matrix
│   │       ├── quality_service.py        # Image sharpness & resolution filter
│   │       └── visual_verification/      # CLAHE-ORB & RANSAC scene matching
│   └── tests/                  # 24 Automated Pytest suites (148 tests)
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Reusable UI (CameraCaptureModal, EvidenceViewer, etc.)
│   │   ├── context/            # AuthContext & state providers
│   │   ├── pages/
│   │   │   ├── citizen/        # Citizen grievance submission & tracking
│   │   │   ├── worker/         # Field worker task queue & evidence capture
│   │   │   ├── reviewer/       # Municipal review queue & forensic slider
│   │   │   └── admin/          # City-wide dashboard & ward metrics
│   │   └── services/           # Axios API client bindings
│   └── package.json
│
├── DEMO_CREDENTIALS.md         # Local development & test seed credentials
├── AUDIT_REPORT.md             # Technical architecture & verification report
├── start_project.py            # Unified cross-platform application launcher
└── README.md
```

---

## 📄 License
Released under the **MIT License**. Built for the Civic Tech Open Innovation Initiative.
