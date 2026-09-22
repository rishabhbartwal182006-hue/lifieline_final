# MediKiosk Real-Time Red-Flag & Triage Engine — Setup Guide

**Smart India Hackathon (SIH) | Component: Triage Engine & Real-Time Decision Support**

This document provides complete, step-by-step instructions to set up, build, test, and run the **MediKiosk Real-Time Red-Flag & Triage Engine** on a fresh machine with zero prior configuration.

---

## 1. Prerequisites

Before installing the project, ensure you have the following software installed:

| Software | Required Version | Purpose | Download Link & Notes |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v18.0.0` or `v20.x` (LTS recommended) | JavaScript/TypeScript runtime | [Download Node.js](https://nodejs.org/en/download/) |
| **npm** | `v9.x` or `v10.x` (bundled with Node.js) | Package manager | Bundled automatically with Node.js |
| **Git** | `v2.30+` | Source control & cloning | [Download Git](https://git-scm.com/downloads) |
| **MongoDB** *(Optional)* | `v6.0+` or `v7.0+` | Persistent database | [Download MongoDB Community](https://www.mongodb.com/try/download/community)<br>*(**Not required for demos**: The engine includes a built-in, zero-config in-memory fallback store with full audit and query support)* |
| **VS Code** *(Recommended)* | Latest | Code editing & debugging | [Download VS Code](https://code.visualstudio.com/) |

> [!NOTE]
> **Zero Global NPM Installs Required**: All utilities (`tsx`, `typescript`, `zod`, `socket.io`, `express`, `cors`) are declared locally inside `triage-engine/package.json`.

---

## 2. Step-by-Step Manual Setup (From Scratch)

Follow these steps in order on a fresh machine:

### Step 1: Clone the Repository
Open PowerShell, Terminal, or Command Prompt:

```bash
git clone https://github.com/rishabhbartwal182006-hue/wincoders-SIH.git
cd wincoders-SIH/triage-engine
```

### Step 2: Install Project Dependencies
Install all local Node.js dependencies:

```bash
npm install
```

### Step 3: Configure Environment Variables
Copy the example environment configuration into a `.env` file:

```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On Linux / macOS / Bash:
cp .env.example .env
```

The default `.env` configuration is pre-configured to run out of the box:
```env
# HTTP & WebSocket Gateway Port
PORT=4000

# MongoDB Connection URI (Optional)
# If omitted or MongoDB is not running, the engine automatically uses internal in-memory storage.
MONGODB_URI=mongodb://localhost:27017/medikiosk_triage
```

### Step 4: Build the Project
Compile the TypeScript code to JavaScript (`dist/` folder):

```bash
npm run build
```

---

## 3. Running Automated Tests

Run the complete test suite (8 test suites covering 100% of the triage pipeline):

```bash
npm test
```

### Individual Test Suites
You can also run specific test suites individually:

| Command | Description |
| :--- | :--- |
| `npm run test:validation` | Phase 1 schema validation & biological plausibility bounds |
| `npm run test:routine` | Phase 2 routine baseline multi-step intake flow |
| `npm run test:urgent` | Phase 2 moderate hypoxemia, tachycardia & risk combination triggers |
| `npm run test:escalation` | Phase 2 real-time critical red-flag escalation triggers |
| `npm run test:dynamic` | Phase 3 dynamic SOCRATES diagnostic questioning & branching |
| `npm run test:socket` | Phase 3 Socket.IO room routing, real-time interruptions & sync |
| `npm run test:edge` | Phase 4 concurrency bursts, deduplication & session isolation |
| `npm run test:demo` | Phase 4 automated end-to-end demo scenarios smoke test |

---

## 4. Running the Real-Time Server

### Development Mode (with Live Reload)
```bash
npm run dev
```
- Starts the Express REST API and Socket.IO real-time server on `http://localhost:4000`.
- Health check URL: [http://localhost:4000/api/health](http://localhost:4000/api/health)

### Production Mode
```bash
npm run build
npm start
```

---

## 5. Running the Live SIH Demonstration

The project provides an automated interactive CLI demo that replays clinical scenarios with live event delays, Socket.IO broadcasts, and audit trail outputs:

### Case 1: Routine Intake (Stable Musculoskeletal Sprain)
```bash
npm run demo -- --case=1
```
*Patient presents with mild wrist pain (3/10), normal vitals. Patient finishes intake in `STANDARD_QUEUE` with zero alarms.*

### Case 2: Urgent Escalation (Cough with Moderate Hypoxemia SpO2 92%)
```bash
npm run demo -- --case=2
```
*Patient presents with persistent cough. Pulse oximeter reports SpO2 92%, escalating priority to `URGENT` (`PRIORITY_REVIEW`) while continuing questionnaire.*

### Case 3: Critical Emergency (Suspected ACS: Chest Pain + Left Arm Radiation + Diaphoresis)
```bash
npm run demo -- --case=3
```
*Patient reports chest discomfort. The instant left arm radiation and sweating are detected, the engine fires `EMERGENCY` in real-time, halts the questionnaire, and alerts the doctor workstation.*

### Run All 3 Scenarios in Succession
```bash
npm run demo -- --case=all
```

---

## 6. Pre-Seeding the Doctor Dashboard

To pre-populate the database with realistic historical patient encounters (`ROUTINE` and `URGENT` cases) for UI queue demonstration:

```bash
npm run demo:seed
```

---

## 7. REST API & WebSocket Reference

### Core REST Endpoints (`http://localhost:4000`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | System health check & active clinical rule count |
| `POST` | `/api/events` | Ingest raw `PatientEvent` envelope |
| `GET` | `/api/events/sessions` | List all historical & active patient encounters |
| `GET` | `/api/events/session/:id` | Retrieve full persisted encounter snapshot |
| `GET` | `/api/events/session/:id/triage` | Get latest calculated triage level & next question |
| `GET` | `/api/events/session/:id/audit` | Get explainable decision audit trail & Markdown table |

### Socket.IO Real-Time Events (`http://localhost:4000`)

| Event Name | Direction | Payload Description |
| :--- | :--- | :--- |
| `JOIN_SESSION` | Client $\rightarrow$ Server | `{ sessionId: string }` — Joins patient kiosk room |
| `JOIN_DASHBOARD` | Client $\rightarrow$ Server | Joins global doctor monitoring room |
| `PATIENT_EVENT_RECEIVED` | Client $\rightarrow$ Server | Ingests live `PatientEvent` (symptom, vital, question answer) |
| `TRIAGE_UPDATED` | Server $\rightarrow$ Client | Broadcasts updated `TriageResult` |
| `RED_FLAG_DETECTED` | Server $\rightarrow$ Client | Alerts when a patient transitions `ROUTINE` $\rightarrow$ `URGENT` |
| `ESCALATION_REQUIRED` | Server $\rightarrow$ Client | High-priority emergency broadcast (`EMERGENCY`) |
| `QUESTIONNAIRE_INTERRUPTED` | Server $\rightarrow$ Client | Halts questionnaire immediately on critical red-flag detection |
| `NEXT_QUESTION` | Server $\rightarrow$ Client | Emits next tailored SOCRATES diagnostic question |

---

## 8. Troubleshooting & FAQ

1. **Port `4000` is already in use (`EADDRINUSE`)**:
   - Change the port in `.env` (e.g. `PORT=5000`) or pass `--port=5000` to the demo runner:
     ```bash
     npm run demo -- --case=1 --port=5000
     ```

2. **Do I need to install MongoDB?**:
   - **No.** If no local MongoDB is detected or `MONGODB_URI` is unset, the engine automatically activates its internal in-memory fallback store with full audit and session querying support.

3. **How do I verify clinical safety and thresholds?**:
   - All clinical thresholds are documented as illustrative demonstration models for hackathon evaluation. See [DISCLAIMER.md](triage-engine/DISCLAIMER.md) for full clinical safety notice.
