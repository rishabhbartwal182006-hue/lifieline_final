# Altitude MVP — FHIR Smoke Test Sequence

This smoke test validates the legitimate end-to-end clinical workflow without bypassing the HPR write-lock or using shortcut routes. FHIR R4 export requires the `VERIFIED_COMMITTED` state, which is established once a verified staff member signs off on the session and triggers synchronization.

---

## 10-Step Execution Flow

### 1. Create Patient Session
- **Endpoint**: `POST /api/v1/sessions`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "kiosk_id": "KIOSK-HIGH-ALT-01",
    "facility_id": "FACILITY-LEH-2600M",
    "language": "en",
    "input_mode": "touch",
    "patient": {
      "name": "Tenzin Norbu",
      "age": 42,
      "gender": "male"
    }
  }
  ```
- **Expected Status**: `201 Created`
- **Validation**: Extract `session_id`. Status is `draft`.

---

### 2. Apply Altitude Environment Context
- **Endpoint**: `POST /api/v1/sessions/:id/environment`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "altitudeMeters": 2600,
    "altitudeFeet": 8530,
    "altitudeSource": "facility_config",
    "altitudeConfidence": 1.0,
    "timeAtAltitudeHours": 2,
    "residenceAltitudeMeters": 200,
    "acclimatizationStatus": "unacclimatized"
  }
  ```
- **Expected Status**: `200 OK`
- **Validation**: `environment.altitudeMeters === 2600`. Audit log `ALTITUDE_CONTEXT_APPLIED` recorded with both `sessionId` and `intakeId`.

---

### 3. Ingest Patient Vitals
- **Endpoint**: `POST /api/v1/sessions/:id/vitals`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  [
    { "type": "bp_systolic", "value": 120, "unit": "mmHg" },
    { "type": "bp_diastolic", "value": 80, "unit": "mmHg" },
    { "type": "spo2", "value": 88, "unit": "%" },
    { "type": "heart_rate", "value": 110, "unit": "bpm" },
    { "type": "blood_glucose", "value": 110, "unit": "mg/dL" }
  ]
  ```
- **Expected Status**: `201 Created`
- **Validation**: Vitals persisted to session and clinical checks recomputed.

---

### 4. Retrieve Interpreted Altitude Vitals
- **Endpoint**: `GET /api/v1/sessions/:id/vitals/interpreted`
- **Expected Status**: `200 OK`
- **Validation**:
  - SpO2 88% evaluated against high altitude expected range (90–95%).
  - Heart rate 110 bpm evaluated against compensatory baseline (70–120 bpm at 2600m).
  - Glucose 110 mg/dL flagged with caution note for altitude > 2500m.

---

### 5. Evaluate Red Flags
- **Endpoint**: `GET /api/v1/sessions/:id/red-flags`
- **Expected Status**: `200 OK`
- **Validation**: Returns active red flags evaluated with altitude context.

---

### 6. Authenticate Clinician via HPR
- **Endpoint**: `POST /api/v1/hpr/login`
- **Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "hprId": "HPR-IN-9876543210",
    "doctorName": "Dr. Ananya Roy, MD",
    "registrationNumber": "KMC-2016-99381",
    "role": "DOCTOR"
  }
  ```
- **Expected Status**: `200 OK`
- **Validation**: Returns active `hprToken` bearer credential.

---

### 7. Staff Verification Sign-Off (Write-Lock Gate)
- **Endpoint**: `POST /api/v1/sessions/:id/staff-verification`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <hprToken>`
- **Request Body**:
  ```json
  {
    "staff_hpr_id": "HPR-IN-9876543210",
    "verification_method": "hpr_credential_login",
    "doctor_notes": "Verified altitude vitals, patient stable. Approved for EHR commit."
  }
  ```
- **Expected Status**: `200 OK`
- **Validation**: `verified: true`, session status transitioned to `staff_verified` / signed.

---

### 8. Synchronize to FHIR / ABDM Pipeline
- **Endpoint**: `POST /api/v1/sessions/:id/fhir-sync`
- **Headers**:
  - `Content-Type: application/json`
  - `Authorization: Bearer <hprToken>`
- **Expected Status**: `202 Accepted`
- **Validation**: Converts session to HL7 FHIR R4 Bundle, saves record to EHR store in `VERIFIED_COMMITTED` status, syncs to ABDM network.

---

### 9. Export Clinical FHIR R4 Bundle
- **Endpoint**: `GET /api/v1/clinical/fhir/bundle/:intakeId`
- **Expected Status**: `200 OK`
- **Validation**:
  - `resourceType: "Bundle"`
  - `type: "document"`
  - Contains Encounter, Patient, and Observation entries with altitude extensions.

---

### 10. Audit Trail Verification
- **Endpoint**: `GET /api/v1/clinical/session/:id/audit` (or `GET /api/v1/sessions/:id/audit`)
- **Expected Status**: `200 OK`
- **Validation**:
  - Audit trail contains `ALTITUDE_CONTEXT_APPLIED` event.
  - Event contains altitude context details (`altitudeMeters: 2600`, `facility_config`).
  - Record matches whether queried by `sessionId` or `intakeId`.
