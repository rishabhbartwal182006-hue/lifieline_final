# MediKiosk - Task 5 Pure Backend Architecture

Production-ready backend architecture for **MediKiosk Task 5** (APIs, Data Pipeline, HL7 FHIR R4 Transformation, HPR Security Middleware, and ABDM Sync).

---

## Architecture & Scope

This service implements a complete multi-modal ingestion and clinical processing pipeline:

1. **Kiosk Multi-Modal Ingestion Endpoint (`POST /api/v1/kiosk/intake`)**:
   - Ingests payloads originating from:
     - **Task 1 (Voice Intake)**: Spoken complaints, HPI, allergies, current medications.
     - **Task 2 (Document OCR)**: Scanned prescriptions and lab report extractions.
     - **Task 3 (Hardware Vitals)**: BP, SpO2, Heart Rate, Temperature, Blood Glucose.
     - **Task 4 (Triage Engine & AYUSH)**: Triage level, urgency score, AYUSH Dashavidha Pariksha parameters.
   - Tags every single field with provenance metadata (`device-captured`, `patient-spoken`, `touch-selected`, `scanned-document`) and a confidence score (`0.0 - 1.0`).
   - Runs automated cross-verification discrepancy checks.
   - Persists intake records in `PROVISIONAL` state in MongoDB (or in-memory store fallback).

2. **HL7 FHIR (R4) Transformation Utility (`services/fhirMapper.js`)**:
   - Converts provisional JSON entries into standard HL7 FHIR (R4) resource bundles:
     - `Patient`: Linked to patient ABHA ID (`https://healthid.abdm.gov.in`).
     - `Observation`: BP panel (component systolic/diastolic), SpO2, Heart Rate, Blood Glucose, and AYUSH Dashavidha parameters.
     - `Condition`: Chief complaints and past diagnoses (coded for ABDM compliance).
     - `DocumentReference`: Scanned prescriptions and lab records.
     - `Composition`: Clinical Summary composition structuring the document.
     - `Bundle`: Standard FHIR R4 `document` bundle.

3. **HPR Biometric Write-Lock Middleware (`POST /api/v1/clinical/commit`)**:
   - Restricts write operations to the permanent hospital database / ABDM network.
   - Enforces Healthcare Professional Registry (HPR) bearer token validation (`hprAuthMiddleware`).
   - Appends an immutable timestamped digital signature block (HMAC-SHA256).
   - Transitions record status from `PROVISIONAL` $\rightarrow$ `VERIFIED_COMMITTED`.
   - Generates HL7 FHIR R4 Bundle and broadcasts to ABDM HIE-CM (Health Information Exchange & Consent Manager) network.

4. **Doctor Dashboard Data APIs (`GET /api/v1/clinical/patient/:id/summary`)**:
   - Pre-consultation draft summary in exact requested order:
     `Vitals` $\rightarrow$ `Chief Complaint` $\rightarrow$ `HPI` $\rightarrow$ `History` $\rightarrow$ `AYUSH Dashavidha Parameters`.
   - Chronological medical timeline of extracted OCR documents.
   - Cross-verification discrepancy flags (e.g. OCR medication mismatch vs spoken history).

---

## File Structure

```
medikiosk-backend-project/
├── server.js                   # API Routing, Middleware execution, Express Bootstrap
├── config/
│   └── db.js                   # Mongoose connection & In-memory Fallback engine
├── models/
│   ├── ProvisionalIntake.js   # Mongoose schema for Intake, Provenance Tags & HPR Signature Block
│   ├── HprAuthToken.js        # Mongoose schema for Healthcare Professional Registry Tokens
│   └── AuditLog.js            # Mongoose schema for security audit logging
├── services/
│   ├── fhirMapper.js          # Pure transformation utility (JSON -> HL7 FHIR R4 Bundle)
│   ├── discrepancyEngine.js   # Cross-verification engine (Voice vs OCR vs Vitals)
│   └── abdmSyncService.js     # ABDM M1, M2, M3 compliance push generator
├── middleware/
│   └── hprAuth.js             # HPR Biometric Write-Lock Security Gatekeeper
├── routes/
│   ├── kioskRoutes.js         # Endpoint POST /api/v1/kiosk/intake
│   ├── clinicalRoutes.js      # Endpoints GET summary, POST commit, GET fhir bundle
│   └── hprRoutes.js           # Doctor authentication & token provisioning
├── seed_data.json             # Sample combined multi-modal payload (Tasks 1–4)
├── test_runner.js             # Automated integration test script
├── postman_collection.json    # Postman collection export
├── package.json
└── README.md
```

---

## Quick Start & Testing

### 1. Run Server
```bash
# Start server (runs on PORT 5000 by default)
node server.js
```

### 2. Run Automated Integration Test Suite
```bash
node test_runner.js
# or
npm test
```

### 3. API Endpoints Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Server Health & ABDM profile status | None |
| `POST` | `/api/v1/kiosk/intake` | Ingest multi-modal kiosk payload | None |
| `GET` | `/api/v1/clinical/patient/:id/summary` | Doctor Dashboard pre-consultation summary | None |
| `POST` | `/api/v1/hpr/login` | Provision doctor HPR auth token | None |
| `POST` | `/api/v1/clinical/commit` | Commit provisional intake to permanent EHR | **HPR Token** (`Authorization: Bearer <hprToken>`) |
| `GET` | `/api/v1/clinical/fhir/bundle/:intakeId` | Export HL7 FHIR (R4) Resource Bundle | None |

---

## Standards Compliance

- **HL7 FHIR (R4)** JSON specification
- **ABDM (Ayushman Bharat Digital Mission)**:
  - M1: ABHA ID Demographics linkage
  - M2: Health Document Linking & Discovery
  - M3: Consent Manager & HIE-CM Health Data Push
- **AYUSH Dashavidha Pariksha**: Coded observations for Nadi, Jihva, Mala, Mutra, Agni, Koshtha, Sparsha, Drik, Akriti, Vaya.
