# MEIKAAN — AI-Powered Civic Evidence Integrity & Work Verification Engine

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.109.0-009688.svg)](https://fastapi.tiangolo.com)
[![React 18](https://img.shields.io/badge/React-18.2-61DAFB.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5.4-646CFF.svg)](https://vitejs.dev/)
[![Pytest](https://img.shields.io/badge/pytest-140%20passed-brightgreen.svg)](https://pytest.org)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**MEIKAAN** is a high-reliability civic governance platform that bridges citizen grievance reporting with tamper-proof, computer-vision-verified field worker task resolution.

Municipalities often struggle with "ghost closures" (workers closing complaint tickets without actually visiting the site or performing genuine repairs), stock photo reuse, and contradictory location readings. MEIKAAN replaces manual guesswork with a multi-layered cryptographic, spatial, and computer vision forensic verification pipeline.

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
               │    Authoritative haversine     │    ORB + CLAHE feature points  │
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

## ✨ Key Capabilities

### 1. Robust Pothole & Road Defect Resolution
- **Where vs. What Separation**: Avoids false negatives caused by expecting raw pixel similarity between a broken road and a smooth asphalt repair.
- **Morphological Depth-Gradient Cavity Detector**: Combines Blackhat top-hat filtering with Sobel edge boundary gradients to isolate true depressions and voids from flat gravel textures.
- **Category-Specific Routing**: Specialized detectors for potholes, stagnant water, and solid waste, with automatic routing of non-visual issues (electrical faults) to human auditors.

### 2. Unified Spatio-Temporal Consistency
- **Authoritative Tolerance Windows**: Consistently evaluates distance against configured bounds plus combined device accuracy:
  $$\text{tolerance} = \max(\text{threshold}, \text{ticket\_accuracy} + \text{evidence\_accuracy})$$
- **Clear Signals**: Emits clean, non-contradictory GPS statuses (`GPS_PASS`, `GPS_BORDERLINE`, `GPS_MISMATCH`, `GPS_UNAVAILABLE`).
- **Velocity Anomaly Detection**: Prevents impossible travel times between consecutive worker submissions.

### 3. Strict Anti-Replay & Freshness Protection
- **Cross-Complaint Replay Detection**: Prohibits reusing evidence files submitted on different complaint cases.
- **Citizen Before-Photo Reuse Prevention**: Catches workers attempting to resubmit the citizen's original complaint photo as proof of work.
- **Legitimate Worker Retries**: Allows workers to retry uploads or reopen tasks without false duplicate penalties.

### 4. Dual Evidence Capture (Mobile Camera & Desktop Webcam)
- **Live Camera Capture**: Full WebRTC camera integration with front/back camera selection, live video preview, photo capture, retake, and real-time device GPS geotagging.
- **File / Gallery Upload**: Fallback option for device photos, passing through identical verification checks.

### 5. Interactive Forensic Reviewer Workspace
- **Forensic Split-View Comparison Slider**: Interactive BEFORE vs. AFTER image comparison with zoom and color inversion controls.
- **Full Signal Transparency**: Real-time breakdown of Location, Scene, Hazard Resolution, Temporal, and Freshness scores.
- **Auditor Governance**: One-click approval, reverification requests, or dispute escalation.

---

## 👥 User Roles & Personas

| Role | Default Credentials | Purpose |
| :--- | :--- | :--- |
| **Citizen** | Public / Self-registration | Reports civic hazards with live photos, captures GPS coordinates, tracks ticket lifecycle and verification certificate. |
| **Field Worker** | `worker@meikaan.gov` / `worker123` | Views assigned ward tasks, captures live on-site repair evidence, initiates automated verification. |
| **Municipal Reviewer** | `reviewer@meikaan.gov` / `reviewer123` | Inspects borderline submissions, reviews visual evidence comparisons, resolves flagged audits. |
| **Administrator** | `admin@meikaan.gov` / `admin123` | Manages wards, oversees city-wide civic metrics, assigns field personnel, manages system configurations. |

---

## 🚀 Quick Start (Single Unified Command)

Start the entire stack (FastAPI backend, React frontend, SQLite database seeding, and automated browser launch) with one command:

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

MEIKAAN includes a comprehensive suite of **140+ unit and end-to-end integration tests**:

```bash
cd backend
pytest -v
```

### Key Test Suites:
- `tests/test_verification_decision_consistency.py`: Validates all 7 GPS tolerance, anti-replay, and pothole resolution scenarios.
- `tests/test_pothole_false_negative_fix.py`: Regression verification for repaired road vs. unrepaired pothole detection.
- `tests/test_camera_upload_evidence_flow.py`: Tests live camera WebRTC flow and file upload evidence pipelines.
- `tests/test_freshness.py`: Cryptographic hash uniqueness and cross-ticket duplicate detection.
- `tests/test_review_workflow.py`: Auditor review queue and governance authorization.

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
│   └── tests/                  # 140+ Automated Pytest suites
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
├── start_project.py            # Unified cross-platform application launcher
└── README.md
```

---

## 📄 License
Released under the **MIT License**. Built for the Civic Tech Open Innovation Initiative.
