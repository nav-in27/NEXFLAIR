# MEIKAAN — Hackathon Demo Script

This document provides a step-by-step guide for presenting MEIKAAN during hackathon judging.

---

## 🚀 Setup & Preparation

To reset the database and seed all 6 deterministic hackathon scenarios:

```bash
# 1. Activate backend environment
cd backend
.\venv\Scripts\activate

# 2. Run deterministic demo seeder
python ..\scripts\seed_demo_data.py

# 3. Launch dev servers (if not already running)
# Backend: http://localhost:8000
# Frontend: http://localhost:5173
```

---

## 🎯 Demo Walkthrough Scenarios

Open the **Hackathon Evidence Investigation Portal** in your browser at:
`http://localhost:5173/investigate` (or click `🔬 Hackathon Demo` in the navigation header).

Use the top **Scenario Control Bar** to switch between scenarios during your presentation.

---

### Scenario 1: GENUINE RESOLUTION

- **Context**: A field worker receives a stagnant water grievance, clears the puddle, and captures live camera evidence.
- **Presenter Steps**:
  1. Select **`1. Genuine Resolution`** on the control bar.
  2. Point out **Visual Match Analysis**: LoFTR / LightGlue keypoint feature matching scores **96 / 100**. Green vector lines connect matching sidewalk and building landmarks.
  3. Point out **Hazard Change**: Initial stagnant water area **12,500 px** reduced to **800 px** (**93.6% reduction**).
  4. Highlight **Civic Evidence Integrity Score**: **95 / 100** $\rightarrow$ **`VERIFIED`**.
  5. Read Explanation: *"The submitted evidence is visually consistent with the original scene (96%) and shows genuine reduction of stagnant water area (93.6%)."*
  6. Click **`[APPROVE]`** button to demonstrate instant closure approval.

---

### Scenario 2: WRONG LOCATION

- **Context**: Worker submits a photo of a park bench instead of the reported street location.
- **Presenter Steps**:
  1. Select **`2. Wrong Location`** on the control bar.
  2. Point out **Visual Match Analysis**: LoFTR / LightGlue detects mismatched scene geometry. Scene consistency drops to **28 / 100**.
  3. Highlight **Civic Evidence Integrity Score**: **42 / 100** $\rightarrow$ **`SUSPICIOUS`**.
  4. Read Explanation: *"Submitted evidence has low visual consistency (28%) with the original complaint scene. Mismatched geometric landmarks detected."*
  5. Click **`[REOPEN TICKET]`** button to send ticket back to open queue.

---

### Scenario 3: NO RESOLUTION

- **Context**: Worker visits the correct location but fails to clear the water puddle.
- **Presenter Steps**:
  1. Select **`3. No Resolution`** on the control bar.
  2. Point out **Visual Match Analysis**: Scene consistency is high (**92 / 100**), confirming correct location.
  3. Point out **Hazard Change**: Water area reduction is only **15.0%** ($12,500\text{ px} \rightarrow 10,625\text{ px}$), below the required $70\%$ threshold.
  4. Highlight **Civic Evidence Integrity Score**: **58 / 100** $\rightarrow$ **`HUMAN_REVIEW`**.
  5. Read Explanation: *"Visual scene is matching (92%), but stagnant water hazard area reduction is only 15.0%, below expected threshold."*
  6. Click **`[REQUEST RE-VERIFICATION]`** to prompt worker for re-clearing.

---

### Scenario 4: REPLAYED EVIDENCE

- **Context**: Worker attempts to reuse a photo previously uploaded for a past ticket.
- **Presenter Steps**:
  1. Select **`4. Replayed Evidence`** on the control bar.
  2. Point out **Freshness Signal**: Freshness score collapses to **12 / 100**.
  3. Highlight **Critical Override**: SHA-256 hash collision identified with past database payload.
  4. Decision: **`SUSPICIOUS`** (**64 / 100**).
  5. Read Explanation: *"CRITICAL: Exact duplicate evidence payload detected in database history. SHA-256 collision identified with Ticket TKT-2026-4821."*

---

### Scenario 5: SPATIO-TEMPORAL ANOMALY (SPEED ANOMALY)

- **Context**: Worker claims ticket verification 15km away only 2 minutes after last activity (impossible velocity).
- **Presenter Steps**:
  1. Select **`5. Speed Anomaly`** on the control bar.
  2. Point out **Temporal Signal**: Temporal score collapses to **20 / 100**.
  3. Highlight calculated travel speed of **240 km/h**.
  4. Decision: **`SUSPICIOUS`** (**67 / 100**).
  5. Read Explanation: *"Spatio-temporal inconsistency detected in consecutive worker tasks. Required travel velocity of 240.0 km/h exceeds human limits."*

---

### Scenario 6: LOW QUALITY EVIDENCE

- **Context**: Worker submits a blurry photo in low light.
- **Presenter Steps**:
  1. Select **`6. Low Quality`** on the control bar.
  2. Point out **Quality Signal**: Quality score drops to **35 / 100** (Laplacian variance 42.1).
  3. Highlight **Fairness Rule**: System does **NOT** falsely accuse worker of fraud or mark suspicious. Instead, routes to **`HUMAN_REVIEW`** (**62 / 100**).
  4. Read Explanation: *"HUMAN_REVIEW forced: Evidence quality flags (BLURRY / Laplacian variance 42.1) detected. Visual quality insufficient for automated engine approval."*

---

## 🏆 Key Takeaways for Judges

1. **Multi-Engine Evidence Fusion**: 7 independent verification engines (Scene, Hazard, Live Capture, Spatial, Temporal, Freshness, Quality).
2. **Separation of Score vs Confidence**: Missing data or low model confidence routes to `HUMAN_REVIEW` rather than false accusations.
3. **No Fake AI Scores**: 100% deterministic, explainable, and reproducible visual pipeline.
