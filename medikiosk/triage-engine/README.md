## Phase 1, 2, 3 & 4: Complete Production-Ready Architecture

The MediKiosk Real-Time Red-Flag & Triage Engine is a fully tested, deterministic healthcare triage and decision-support system built for SIH:
1. **Phase 1**: Strict Zod data contracts, SOCRATES symptom models, and biological plausibility validation.
2. **Phase 2**: Deterministic, explainable rule engine with multi-condition AND-logic and session accumulation.
3. **Phase 3**: Real-time Socket.IO streaming, dynamic SOCRATES questioning flow, and emergency interruption.
4. **Phase 4**: Scripted demo scenarios, CLI replay runner, append-only explainability audit logging, and edge-case stress hardening.

---

### 📁 Complete Project Structure

```text
triage-engine/
├── src/
│   ├── schemas/                # Phase 1: Zod validation contracts
│   │   ├── patientEvent.ts     # Generic event envelope, discriminated union, & validatePatientEvent()
│   │   ├── symptom.ts          # SOCRATES-inspired symptom assessment schema
│   │   ├── vitalEvent.ts       # Vital signs schema with biological plausibility guards
│   │   ├── questionnaire.ts    # Red-flag & intake questionnaire response schema
│   │   ├── triageResult.ts     # Standardized output contract for Doctor Dashboard
│   │   └── index.ts            # Schema re-exports
│   ├── rules/                  # Phase 2: Declarative rule definitions
│   │   ├── types.ts            # Rule, Condition, Operator, and Priority definitions
│   │   ├── cardiac/            # ACS red-flag and cardiogenic shock rules
│   │   ├── respiratory/        # Critical (<90%) and moderate (90-94%) hypoxemia rules
│   │   ├── neurological/       # Thunderclap headache / SAH rules
│   │   ├── vitals/             # Severe tachycardia, bradycardia, hypotension rules
│   │   ├── general/            # Severe intractable pain & medication interaction rules
│   │   └── index.ts            # Master registry (ALL_RULES) & category lookups
│   ├── engine/                 # Phase 2: Rule execution & triage resolver
│   │   ├── sessionState.ts     # In-memory cumulative session state & triage history
│   │   ├── evaluateRules.ts    # Declarative rule evaluator (nested paths & AND logic)
│   │   ├── calculateTriage.ts  # Deterministic triage level resolver & rationale builder
│   │   └── index.ts            # Public API: processPatientEvent() & processPatientEventSafe()
│   ├── events/                 # Phase 3: Socket.IO event layer
│   │   ├── socketEvents.ts     # Event constants & typed payloads
│   │   ├── socketHandlers.ts   # Room-based socket event listeners & dispatchers
│   │   └── escalationEvents.ts # High-priority emergency & interruption broadcaster
│   ├── questionnaire/          # Phase 3: Dynamic questioning & SOCRATES flow
│   │   ├── socratesFlow.ts     # SOCRATES question battery & anatomical branching
│   │   ├── symptomRouter.ts    # Clinical symptom-to-question battery router
│   │   └── questionSelector.ts # State-aware next-question selector & interruption check
│   ├── server/                 # Phase 3: Express & Socket.IO server bootstrap
│   │   ├── app.ts              # Express application with CORS, JSON body, and /api/health
│   │   ├── httpServer.ts       # HTTP + Socket.IO server lifecycle
│   │   └── routes/
│   │       └── patientEvent.ts # REST fallback routes & session/audit history APIs
│   ├── persistence/            # Phase 4: Data persistence & audit trail
│   │   ├── mongoClient.ts      # Dual-mode connection client (MongoDB + zero-config memory fallback)
│   │   ├── sessionRepository.ts # Persistent storage for past patient encounters
│   │   ├── auditLog.ts         # Append-only chronological audit logger with markdown generator
│   │   └── index.ts            # Persistence re-exports
│   ├── demo/                   # Phase 4: Scripted judge scenarios & CLI runner
│   │   ├── scenarios.ts        # The 3 canonical demo event sequences
│   │   ├── runDemo.ts          # CLI runner with formatted terminal output
│   │   └── seedDashboard.ts    # Mock past encounter seeder for Doctor Dashboard
│   └── index.ts                # Package entry point
├── tests/
│   ├── index.ts                # Master test runner executing all 8 test suites
│   ├── runValidationTests.ts   # Phase 1 schema & plausibility test suite
│   ├── routineCases.test.ts    # Multi-event sequence for stable routine patients
│   ├── urgentCases.test.ts     # Multi-event combinations escalating to URGENT
│   ├── escalationCases.test.ts # Real-time emergency escalations upon pattern completion
│   ├── dynamicQuestioning.test.ts # Unit tests for SOCRATES flow & question selection
│   ├── socketFlow.test.ts      # End-to-end Socket.IO client integration tests
│   ├── edgeCases.test.ts       # Stress test (concurrency, deduplication, garbage, isolation)
│   └── demoScenarios.test.ts   # Automated pre-flight smoke test of all 3 demo cases
├── DISCLAIMER.md               # Official clinical safety & regulatory notice
├── tsconfig.json
└── package.json
```

---

### 🎬 SIH Live Demo Instructions

You can run the simulated interactive demo directly in the terminal to demonstrate the system live to judges:

#### 1. Run Canonical Demo Cases:
- **Case 1 (Routine - Stable Sprain)**:
  ```bash
  npm run demo -- --case=1
  ```
  *Walks through mild symptom entry, normal vitals, and dynamic questions. Stays in `ROUTINE` queue.*

- **Case 2 (Urgent - Moderate Hypoxemia)**:
  ```bash
  npm run demo -- --case=2
  ```
  *Patient reports cough; pulse oximeter registers SpO2 92%. Escalates to `URGENT` while allowing the questionnaire to continue.*

- **Case 3 (Emergency - Suspected ACS Red Flag)**:
  ```bash
  npm run demo -- --case=3
  ```
  *Patient reports chest discomfort. The instant Left Arm radiation and cold sweating are detected on Step 3, the engine **instantly fires an EMERGENCY escalation**, interrupts the kiosk questionnaire, and alerts the doctor workstation.*

- **Run All 3 Cases Sequentially**:
  ```bash
  npm run demo -- --case=all
  ```

#### 2. Start the Standalone Live Server:
```bash
npm run dev
```
*Starts HTTP REST & Socket.IO server on `http://localhost:4000` with `/api/health` and WebSocket rooms.*

#### 3. Pre-Seed Doctor Dashboard with Past Patients:
```bash
npm run demo:seed
```

#### 4. Run the Full Pre-Flight Smoke Test Suite:
```bash
npm test
```
*Executes all 8 test suites (Validation, Routine, Urgent, Escalation, Dynamic Questioning, Sockets, Edge Cases, Demo Scenarios).*

---

### 📊 Explainability & Audit Logging

When asked by judges *"Why did the system escalate to EMERGENCY?"*, the engine provides an immutable, append-only audit trail accessible via:
- REST API: `GET /api/events/session/:sessionId/audit`
- Markdown Table: [formatAuditTrailMarkdown()](file:///c:/Users/SAHIL/Desktop/File/wincoders-SIH/triage-engine/src/persistence/auditLog.ts#L60)

---

### ⚠️ Clinical Advisory Notice
All numerical thresholds and rule conditions are illustrative demonstration models for SIH hackathon evaluation. See [DISCLAIMER.md](file:///c:/Users/SAHIL/Desktop/File/wincoders-SIH/triage-engine/DISCLAIMER.md) for full clinical safety and regulatory notice.


---

### 📁 Complete Project Structure

```text
triage-engine/
├── src/
│   ├── schemas/                # Phase 1: Zod validation contracts
│   │   ├── patientEvent.ts     # Generic event envelope, discriminated union, & validatePatientEvent()
│   │   ├── symptom.ts          # SOCRATES-inspired symptom assessment schema
│   │   ├── vitalEvent.ts       # Vital signs schema with biological plausibility guards
│   │   ├── questionnaire.ts    # Red-flag & intake questionnaire response schema
│   │   ├── triageResult.ts     # Standardized output contract for Doctor Dashboard
│   │   └── index.ts            # Schema re-exports
│   ├── rules/                  # Phase 2: Declarative rule definitions
│   │   ├── types.ts            # Rule, Condition, Operator, and Priority definitions
│   │   ├── cardiac/            # ACS red-flag and cardiogenic shock rules
│   │   ├── respiratory/        # Critical and moderate hypoxemia rules
│   │   ├── neurological/       # Thunderclap headache / SAH rules
│   │   ├── vitals/             # Severe tachycardia, bradycardia, hypotension rules
│   │   ├── general/            # Severe intractable pain & medication interaction rules
│   │   └── index.ts            # Master registry (ALL_RULES) & category lookups
│   ├── engine/                 # Phase 2: Rule execution & triage resolver
│   │   ├── sessionState.ts     # In-memory cumulative session state & triage history
│   │   ├── evaluateRules.ts    # Declarative rule evaluator (nested paths & AND logic)
│   │   ├── calculateTriage.ts  # Deterministic triage level resolver & rationale builder
│   │   └── index.ts            # Public API: processPatientEvent() & processPatientEventSafe()
│   ├── events/                 # Phase 3: Socket.IO event layer
│   │   ├── socketEvents.ts     # Event constants & typed payloads
│   │   ├── socketHandlers.ts   # Room-based socket event listeners & dispatchers
│   │   └── escalationEvents.ts # High-priority emergency & interruption broadcaster
│   ├── questionnaire/          # Phase 3: Dynamic questioning & SOCRATES flow
│   │   ├── socratesFlow.ts     # SOCRATES question battery & anatomical branching
│   │   ├── symptomRouter.ts    # Clinical symptom-to-question battery router
│   │   └── questionSelector.ts # State-aware next-question selector & interruption check
│   ├── server/                 # Phase 3: Express & Socket.IO server bootstrap
│   │   ├── app.ts              # Express application with CORS, JSON body, and health check
│   │   ├── httpServer.ts       # HTTP + Socket.IO server lifecycle
│   │   └── routes/
│   │       └── patientEvent.ts # REST fallback routes (POST /api/events, GET /api/events/session/:id/triage)
│   └── index.ts                # Package entry point
├── tests/
│   ├── index.ts                # Master test runner (Phases 1-3)
│   ├── runValidationTests.ts   # Phase 1 schema & plausibility test suite
│   ├── routineCases.test.ts    # Multi-event sequence for stable routine patients
│   ├── urgentCases.test.ts     # Multi-event combinations escalating to URGENT
│   ├── escalationCases.test.ts # Real-time emergency escalations upon pattern completion
│   ├── dynamicQuestioning.test.ts # Unit tests for SOCRATES flow & question selection
│   ├── socketFlow.test.ts      # End-to-end Socket.IO client integration tests
│   └── clientDemo.ts           # Interactive real-time demo script
├── tsconfig.json
└── package.json
```

---

### 🚀 Running the Server & Testing

Start the Real-Time Server:
```bash
cd triage-engine
npm run dev       # Starts HTTP + Socket.IO server on port 4000
```

Run Interactive Client Demo:
```bash
npm run demo:client
```

Execute Complete Test Suite:
```bash
npm test
```

---

### 📡 Socket.IO Real-Time Event Contracts

#### Client $\rightarrow$ Server Events
- `JOIN_SESSION` `{ sessionId: string }`: Kiosk client joins room `session:${sessionId}` and receives state sync.
- `JOIN_DASHBOARD` `{}`: Doctor workstation joins `dashboard` room to receive all live triage alerts.
- `PATIENT_EVENT_RECEIVED` `PatientEvent`: Ingests any symptom, vital, or questionnaire answer.
- `VITAL_UPDATED` `PatientEvent`: Dedicated vital sign ingestion event.
- `GET_LATEST_TRIAGE` `{ sessionId: string }`: Retrieves latest state for reconnection recovery.

#### Server $\rightarrow$ Client Events
- `NEXT_QUESTION`: Emitted to Kiosk UI with the next pertinent question and progress indicator.
- `TRIAGE_UPDATED`: Emitted to Kiosk and Doctor Dashboard whenever priority or triggered rules change.
- `RULE_TRIGGERED`: Emitted when any clinical rule newly fires.
- `RED_FLAG_DETECTED`: Emitted when a patient transitions from `ROUTINE` to `URGENT` or `EMERGENCY`.
- `ESCALATION_REQUIRED`: Broadcast to Doctor Dashboard on high-priority channel for `EMERGENCY` events.
- `QUESTIONNAIRE_INTERRUPTED`: Broadcast to Kiosk UI to immediately stop routine questioning upon emergency detection.


---

### 📁 Project Structure

```text
triage-engine/
├── src/
│   ├── schemas/
│   │   ├── patientEvent.ts     # Generic event envelope, discriminated union, & validatePatientEvent()
│   │   ├── symptom.ts          # SOCRATES-inspired symptom assessment schema
│   │   ├── vitalEvent.ts       # Vital signs schema with biological plausibility guards
│   │   ├── questionnaire.ts    # Red-flag & intake questionnaire response schema
│   │   ├── triageResult.ts     # Standardized output contract for Doctor Dashboard
│   │   └── index.ts            # Schema re-exports
│   ├── rules/
│   │   ├── types.ts            # Rule, Condition, Operator, and Priority definitions
│   │   ├── cardiac/            # ACS red-flag and cardiogenic shock rules
│   │   ├── respiratory/        # Critical and moderate hypoxemia rules
│   │   ├── neurological/       # Thunderclap headache / SAH rules
│   │   ├── vitals/             # Severe tachycardia, bradycardia, hypotension rules
│   │   ├── general/            # Severe intractable pain & medication interaction rules
│   │   └── index.ts            # Master registry (ALL_RULES) & category lookups
│   ├── engine/
│   │   ├── sessionState.ts     # In-memory cumulative session state per sessionId
│   │   ├── evaluateRules.ts    # Declarative rule evaluator (nested paths & AND logic)
│   │   ├── calculateTriage.ts  # Deterministic triage level resolver & rationale builder
│   │   └── index.ts            # Public API: processPatientEvent() & processPatientEventSafe()
│   └── index.ts                # Package entry point
├── tests/
│   ├── index.ts                # Master test runner
│   ├── runValidationTests.ts   # Phase 1 schema & plausibility test suite
│   ├── routineCases.test.ts    # Multi-event sequence for stable routine patients
│   ├── urgentCases.test.ts     # Multi-event combinations escalating to URGENT
│   └── escalationCases.test.ts # Real-time emergency escalations upon pattern completion
├── tsconfig.json
└── package.json
```

---

### 🚀 Running the Engine & Test Suites

```bash
cd triage-engine
npm test
```

Individual test runners:
```bash
npm run test:validation   # Runs Phase 1 schema tests
npm run test:routine      # Runs Phase 2 routine cases
npm run test:urgent       # Runs Phase 2 urgent cases
npm run test:escalation   # Runs Phase 2 real-time escalation cases
```

---

### ⚙️ How Rule Evaluation & Triage Calculation Works

1. **Stateful Ingestion ([sessionState.ts](file:///c:/Users/SAHIL/Desktop/File/wincoders-SIH/triage-engine/src/engine/sessionState.ts))**:
   - Every validated event is ingested into an active in-memory session accumulator indexed by `sessionId`.
   - Vitals are stored by vital type, symptoms are merged into an active clinical picture (tracking peak severity, all radiation vectors, all associated symptoms), and questionnaire answers are mapped by `questionId`.

2. **Declarative Rule Evaluation ([evaluateRules.ts](file:///c:/Users/SAHIL/Desktop/File/wincoders-SIH/triage-engine/src/engine/evaluateRules.ts))**:
   - Each rule in the registry (`ALL_RULES`) defines a set of declarative `Condition` predicates with dot-notated field paths (e.g., `"vitals.SPO2.value"`, `"symptoms.allRadiations"`, `"questionnaire.MED_ON_BLOOD_THINNERS.answerValue"`).
   - Operators supported: `equals`, `notEquals`, `greaterThan`, `greaterThanOrEqual`, `lessThan`, `lessThanOrEqual`, `includes`, `inArray`, `between`, `exists`.
   - Multi-condition **AND logic** is enforced per rule.

3. **Deterministic Triage Resolver ([calculateTriage.ts](file:///c:/Users/SAHIL/Desktop/File/wincoders-SIH/triage-engine/src/engine/calculateTriage.ts))**:
   - **Escalation Hierarchy**: If *ANY* `EMERGENCY` rule fires $\rightarrow$ Level is `EMERGENCY` (`action: IMMEDIATE_DOCTOR_ALERT`). Else if *ANY* `URGENT` rule fires $\rightarrow$ Level is `URGENT` (`action: PRIORITY_REVIEW`). Otherwise $\rightarrow$ Level is `ROUTINE` (`action: STANDARD_QUEUE`).
   - Compiles a transparent, bulleted clinical rationale detailing all triggered rule descriptions for doctor review.

---

### ⚠️ Demonstration Clinical Thresholds (Hackathon Placeholders)

> [!IMPORTANT]
> The thresholds below are **demonstration models** for SIH evaluation. Prior to clinical deployment, all rules and threshold parameters must be reviewed and calibrated against certified institutional protocols (e.g. AHA/BTS/NICE/AIIMS guidelines).

| Rule ID | Category | Priority | Demo Condition Criteria | Clinical Context |
| :--- | :--- | :--- | :--- | :--- |
| `RULE_CARDIAC_ACS_RED_FLAG` | Cardiac | `EMERGENCY` | `site == 'CHEST'` AND `radiation includes 'LEFT_ARM'` AND `associatedSymptoms includes 'SWEATING'` | Suspected Acute Coronary Syndrome |
| `RULE_CARDIAC_CHEST_PAIN_HYPOTENSION` | Cardiac | `EMERGENCY` | `site == 'CHEST'` AND `Systolic BP < 90 mmHg` | Cardiogenic Shock / Hemodynamic Collapse |
| `RULE_RESPIRATORY_CRITICAL_HYPOXEMIA` | Respiratory | `EMERGENCY` | `SpO2 < 90%` | Severe Acute Hypoxemia |
| `RULE_RESPIRATORY_MODERATE_HYPOXEMIA` | Respiratory | `URGENT` | `SpO2 between [90%, 94%]` | Moderate Hypoxemia |
| `RULE_NEURO_THUNDERCLAP_HEADACHE` | Neurological | `EMERGENCY` | `site == 'HEAD'` AND `onset == 'SUDDEN_THUNDERCLAP'` AND `severity >= 7` | Subarachnoid Hemorrhage Screening |
| `RULE_VITALS_SEVERE_TACHYCARDIA` | Vitals | `URGENT` | `Heart Rate > 150 bpm` | Severe Tachyarrhythmia |
| `RULE_VITALS_SEVERE_BRADYCARDIA` | Vitals | `URGENT` | `Heart Rate < 40 bpm` | Severe Bradycardia / Conduction Risk |
| `RULE_VITALS_HYPOTENSION_CRITICAL` | Vitals | `EMERGENCY` | `Systolic BP < 90 mmHg` | Critical Hypotension / Shock |
| `RULE_GENERAL_SEVERE_PAIN` | General | `URGENT` | `Peak Pain Severity >= 8/10` | Severe Acute Pain Distress |
| `RULE_SCREENING_ANTICOAGULANT_HEAD_INJURY` | General | `URGENT` | `MED_ON_BLOOD_THINNERS == true` AND `site == 'HEAD'` | High Intracranial Hemorrhage Risk |


---

### 📁 Project Structure

```text
triage-engine/
├── src/
│   ├── schemas/
│   │   ├── patientEvent.ts     # Generic event envelope, discriminated union, & validatePatientEvent()
│   │   ├── symptom.ts          # SOCRATES-inspired symptom assessment schema
│   │   ├── vitalEvent.ts       # Vital signs schema with biological plausibility guards
│   │   ├── questionnaire.ts    # Red-flag & intake questionnaire response schema
│   │   ├── triageResult.ts     # Standardized output contract for Doctor Dashboard
│   │   └── index.ts            # Schema re-exports
│   ├── engine/
│   │   └── index.ts            # Phase 2 Rule Engine interface stub
│   └── index.ts                # Package entry point
├── tests/
│   └── runValidationTests.ts   # Interactive test suite & runnable demo
├── tsconfig.json
└── package.json
```

---

### 🚀 Running the Validation Suite & Demo

```bash
cd triage-engine
npm install
npm test
```

To build TypeScript declaration and JavaScript bundles:
```bash
npm run build
```

---

### 🩺 Schema Design Decisions & Clinical Alignment

1. **Generic `PatientEvent` Envelope**:
   - Isolates transport metadata (`id`, `timestamp`, `sessionId`, `patientId`, `source`) from business payloads.
   - Enforces discriminated union validation via `eventType` (`NEW_SYMPTOM_ADDED`, `NEW_VITAL_READING`, `NEW_QUESTIONNAIRE_ANSWER`, etc.).
   - `sessionId` groups events into an active patient timeline for stateful rule processing in Phase 2.

2. **`SymptomPayload` (SOCRATES Framework)**:
   - Built on the clinical **SOCRATES** assessment protocol (*Site, Onset, Character, Radiation, Associated symptoms, Time course, Exacerbating/relieving factors, Severity*).
   - Provides discrete, typed fields ready for syndromic rule triggers (e.g. Chest pain + left arm radiation + diaphoresis).

3. **`VitalPayload` (Physiological Plausibility Guards)**:
   - Validates ranges for Heart Rate, Blood Pressure, SpO2, Temperature, Respiratory Rate, and Blood Glucose.
   - **Crucial distinction**: Enforces physical hardware/biological sanity (e.g. `SpO2 <= 100%`, `Systolic > Diastolic`) to catch sensor disconnects or entry typos, while strictly separating clinical triage threshold logic for Phase 2.

4. **`QuestionnairePayload`**:
   - Structured responses (`BOOLEAN`, `SINGLE_CHOICE`, `MULTI_CHOICE`, `NUMERIC`, `FREE_TEXT`) with categorized domain scopes (`RED_FLAG_SCREENING`, `CARDIOVASCULAR`, `MEDICATION_HISTORY`).

5. **`TriageResult` Contract**:
   - Predictable output shape (`triageLevel`: `EMERGENCY` | `URGENT` | `ROUTINE`, `triggeredRules`, `action`, `reason`, `timestamp`, `metadata`) consumed directly by Doctor Workstations and WebSocket listeners.
