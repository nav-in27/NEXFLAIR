# MEIKAAN — Civic Evidence Integrity Engine

MEIKAAN is a high-reliability civic technology platform designed to verify, authenticate, and maintain the tamper-proof integrity of digital civic evidence (photos, video footage, official document scans). 

Using cryptographic payload hashing (SHA-256 Merkle trees), EXIF metadata inspection, and Error Level Analysis (ELA) computer vision algorithms, MEIKAAN produces immutable proof certificates and transparent forensic reports.

---

## 🏛️ Key Features

- 🛡️ **Cryptographic Evidence Hashing**: Computes SHA-256 payload digests and constructs Merkle audit tree proofs.
- 🔬 **Forensic Computer Vision Engine**: Performs Error Level Analysis (ELA) to detect JPEG re-compression anomalies and digital image manipulation.
- 📍 **EXIF Metadata Inspection**: Extracts capture timestamp, GPS coordinates, device signature, and software editing footprints.
- 📜 **Immutable Ledger & Audit Trail**: Maintains a transparent tamper-resistant transaction log.
- 📄 **Evidence Integrity Certificates**: Generates downloadable audit certificates with QR verification proofs.
- 🎨 **Modern Civic UI Portal**: Built with React 18, Vite, dynamic visual status badges, and glassmorphism styling.

---

## 🏗️ Architecture

```
MEIKAAN Frontend (React 18 + Vite)
       │
       ▼ REST / API
FastAPI Backend (Python 3.11)
  ├── Forensic Analysis Service (OpenCV + ELA + EXIF)
  ├── Cryptographic Hash & Merkle Ledger Service
  └── SQLite / PostgreSQL Database
```

---

## 🚀 Quick Start (Single Command)

Run the unified launcher script to start database, backend API, frontend UI, seed demo data, and open the web app automatically:

```bash
python start_project.py
```

*(Alternatively, you can run `./start_project.sh` on Linux/macOS, `.\start_project.bat` or `.\start_project.ps1` on Windows)*

---

## 🛠️ Manual Setup (Optional)

### 1. Backend Setup

```bash
cd backend
python -m venv venv
# On Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Install dependencies:
pip install -r requirements.txt
# Run API server:
uvicorn app.main:app --reload --port 8000
```

Backend API will be available at `http://localhost:8000`.  
Swagger Interactive Docs: `http://localhost:8000/docs`

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend UI will be available at `http://localhost:5173`.

---

## 🧪 Running Tests

```bash
cd backend
pytest
```

---

## 📄 License
MIT License - Civic Evidence Open Initiative.
