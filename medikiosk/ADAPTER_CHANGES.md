# Adapter layer: openapi spec ⇄ existing b1 backend

This adds the session-lifecycle REST API from `medikiosk-openapi.yaml` /
`medikiosk_schema.json` on top of the existing b1 backend, without touching
its working logic. Both API contracts now run side by side.

## New files
- `models/Session.js` — Mongoose model storing sessions in the **exact**
  spec shape (snake_case: `session_id`, `patient`, `consent`, `intake`,
  `vitals[]`, `documents[]`, `cross_check_discrepancies[]`, `red_flags[]`,
  `staff_verification`, `clinical_summary`, `fhir_sync`, `post_consultation`).
- `services/specAdapter.js` — translates a `Session` doc into the camelCase
  shape `services/discrepancyEngine.js` and `services/fhirMapper.js` already
  expect, and translates their output back into spec shape. This is the
  actual bridge — neither existing service was modified.
- `services/redFlagRules.js` — small rule set (chest pain + diaphoresis,
  hypertensive crisis/stage-2, hypoxia) so `/red-flags` has something real to
  return. The much more thorough TS triage engine in `triage-engine/src/rules`
  is still there for deeper clinical logic later — this isn't a replacement.
- `middleware/specAuth.js` — bearer-token check for the new routes, reusing
  the existing `HprAuthToken` store (same tokens `/api/v1/hpr/login` issues).
  **Demo-mode caveat:** if no token has ever been issued, auth is left open
  so the flow isn't blocked before any staff has logged in. Once a token
  exists, auth is enforced normally. Tighten before real deployment.
- `routes/sessionRoutes.js` — implements every endpoint in the spec:
  `/sessions`, `/sessions/:id`, `.../intake`, `.../vitals`, `.../documents`,
  `.../documents/:id`, `.../discrepancies`, `.../red-flags`,
  `.../red-flags/:id/acknowledge`, `/auth/staff-login`,
  `.../staff-verification`, `.../clinical-summary`, `.../fhir-sync`,
  `.../post-consultation`. Mounted at `/api/v1` in `server.js`, so full paths
  are `/api/v1/sessions`, `/api/v1/auth/staff-login`, etc.

## Modified files
- `server.js` — two lines: `require('./routes/sessionRoutes')` and
  `app.use('/api/v1', sessionRoutes)`.
- `models/ProvisionalIntake.js` — fixed a bug: `VitalValueSchema` referenced
  an undefined `SchemaValue` variable (`type: SchemaValue = mongoose.Schema.Types.Mixed`).
  Changed to `type: mongoose.Schema.Types.Mixed`.

## What's bridged vs. what's separate
- FHIR conversion and HPR/ABDM commit logic are **shared** — `fhir-sync` on
  a spec-based session writes into the same `ProvisionalIntake` collection
  the legacy pipeline uses, so `GET /api/v1/clinical/fhir/bundle/:intakeId`
  and `GET /api/v1/clinical/patient/:id/summary` work for spec-based sessions
  too, keyed by `session_id`.
- Everything else (the two data models, the two status-lifecycle enums, the
  two auth token issuance endpoints) stays separate on purpose — merging
  them would mean picking one contract and breaking whichever client (kiosk
  UI vs. whatever's built against the openapi spec) depends on the other.

## Known gaps (by design, not bugs)
- **Document upload** (`POST /sessions/:id/documents`) accepts a JSON body
  with `document_type`, `scan_method`, and optionally pre-extracted
  `extracted_fields` — not real `multipart/form-data` file upload + OCR.
  Actual OCR is Task 2's workstream; this backend has never done image
  processing, so this endpoint accepts the OCR *output* shape rather than
  fabricating an OCR pipeline.
- Red-flag rules here are intentionally minimal (see `redFlagRules.js`) —
  swap in calls to the standalone `triage-engine` service for real coverage.

## Quick test
```bash
npm install
node server.js
# POST /api/v1/sessions -> PUT .../intake -> GET .../red-flags
# POST /api/v1/auth/staff-login -> POST .../staff-verification (Bearer token)
# PUT .../clinical-summary (with signed_by_hpr_id + signed_at) -> POST .../fhir-sync
```
