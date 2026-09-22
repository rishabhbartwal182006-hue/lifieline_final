# Clinical Safety & Regulatory Disclaimer

**Smart India Hackathon (SIH) — MediKiosk Smart Healthcare Kiosk Project**

---

### 1. Prototype & Academic Research Status

This system is an **academic and technical proof-of-concept (PoC)** developed for the Smart India Hackathon (SIH). It is designed to demonstrate architectural capabilities for:
- Deterministic, explainable triage decision rules.
- Real-time physiological signal validation and peripheral hardware ingestion.
- Dynamic questionnaire branching (SOCRATES framework).
- Low-latency event streaming via WebSockets.

---

### 2. Clinical Thresholds & Medical Advisory Notice

> [!WARNING]
> **NOT CERTIFIED AS A MEDICAL DEVICE (SaMD)**:
> The numerical cutoff values, vital sign ranges, and rule predicates implemented within this codebase (e.g. Heart Rate > 150 bpm, SpO2 < 90%, Systolic BP < 90 mmHg, pain scale thresholds) are **illustrative demonstration models**.

Before any clinical deployment, field pilot, or integration with actual hospital triage pipelines:
1. **Institutional Review**: All rules and condition thresholds must be reviewed, calibrated, and formally approved by a certified clinical advisory board (e.g., in accordance with AIIMS, AHA, ESC, BTS, or WHO guidelines).
2. **Population Calibration**: Vital baseline limits must be tailored for specific patient cohorts (e.g., pediatric patients, geriatric patients, or individuals with chronic obstructive pulmonary disease).
3. **Hardware Certification**: Hardware peripherals (pulse oximeters, blood pressure monitors) must meet CDSCO / ISO 13485 medical device regulatory standards.

---

### 3. Explainability & Doctor-in-the-Loop Architecture

The triage engine does **not** make autonomous diagnostic or prescription decisions. It acts strictly as a **decision support layer** to prioritize physician attention:
- Every triage recommendation produces an append-only, explainable audit trail detailing the exact triggering conditions.
- Final medical assessment, diagnosis, and treatment pathways remain the exclusive responsibility of qualified licensed healthcare practitioners.
