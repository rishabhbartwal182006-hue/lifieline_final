# LifeLine 360 — Next-Generation Smart Healthcare Ecosystem & AI MediKiosk

> **Autonomous Hospital Triage, Bio-Optical Diagnostic Telemetry, and Remote Patient Monitoring (RPM)**
> 
> *A unified, multi-node clinical platform connecting smart hospital kiosks, home care telemetry, and physician command centers in real time.*

---

## 🌟 Executive Summary

**LifeLine 360** bridges the gap between emergency hospital admission and continuous home care. By combining edge IoT medical sensors, AI computer vision diagnostics, automated mechanical containment, and a multilingual voice assistant, the platform reduces hospital triage bottlenecks, eliminates manual logging errors, and provides doctors with continuous, verified patient vitals.

---

## 🏗️ System Architecture & Core Pillars

The ecosystem operates across three synchronized nodes coordinated by a real-time event-driven architecture:

```
                                  ┌────────────────────────────────────────┐
                                  │      LifeLine 360 Unified Core         │
                                  │       Node.js / Express / Socket.IO    │
                                  │               Port: 4000               │
                                  └───────────────────┬────────────────────┘
                                                      │
         ┌────────────────────────────────────────────┼────────────────────────────────────────┐
         │                                            │                                        │
         ▼                                            ▼                                        ▼
┌─────────────────────────┐              ┌─────────────────────────┐              ┌─────────────────────────┐
│         NODE 1          │              │         NODE 2          │              │         NODE 3          │
│ Hospital MediKiosk &    │              │ Home Care Companion &   │              │ Doctor Command Center   │
│ Patient Terminal        │              │ Remote Monitoring (RPM) │              │ & Tele-Consultation     │
├─────────────────────────┤              ├─────────────────────────┤              ├─────────────────────────┤
│ • React 19 Terminal     │              │ • LifeLine 360 Patient  │              │ • Real-Time Triage HUD  │
│ • Motorized Servo Door  │              │ • Bio-Optical Vitals    │              │ • Live RPM Telemetry    │
│ • AI Vision Vitals      │              │ • DHT11 Room Climate    │              │ • Prescription Sync     │
│ • NOVA Voice Assistant  │              │ • Medication Adherence  │              │ • Emergency SOS Alerts  │
└─────────────────────────┘              └─────────────────────────┘              └─────────────────────────┘
         │                                            │                                        │
         ▼                                            ▼                                        ▼
┌─────────────────────────┐              ┌─────────────────────────┐              ┌─────────────────────────┐
│ Vital Vision AI Engine  │              │ Embedded IoT Nodes      │              │ NOVA Voice AI Assistant │
│ FastAPI / Groq Vision   │              │ ESP32 Optical + Climate │              │ Speech-to-Text / LLM    │
│ Port: 8000              │              │ ESP32 Motorized Door    │              │ Port: 3000              │
└─────────────────────────┘              └─────────────────────────┘              └─────────────────────────┘
```

### 1. Node 1: Smart Hospital MediKiosk & Patient Terminal (`:4000/terminal` & `:5173`)
- **Self-Service Check-In**: Rapid demographic capture, insurance card lookup, and OTP identity verification.
- **SOCRATES Emergency Triage**: Algorithmic symptom routing with red-flag detection (Cardiovascular, Respiratory, Neurological) classifying urgency into *Emergency (Level 1)*, *Urgent (Level 2)*, or *Routine (Level 3)*.
- **Motorized Device Bay**: Microcontroller-actuated bay door (ESP32 Node 3 on GPIO 2) that smoothly opens $180^\circ$ for diagnostic device placement and seals automatically ($6^\circ$) during sanitization and step completion.
- **Bio-Optical Vision Scanner**: Captures glucometer, pulse oximeter, and blood pressure meter displays with zero manual data entry.

### 2. Node 2: Personal Home Station & RPM (`:4000/home-patient`)
- **Bio-Optical Diagnostic Terminal**: High-precision computer vision HUD with laser-sweep animations and real-time validation—eliminating raw webcam artifacts and exposed hardware IPs.
- **Ambient Room Climate Sync**: Dedicated DHT11 one-wire bit-bang sensor on GPIO 13 providing ambient temperature and humidity to detect hyperthermia, hypothermia, and respiratory trigger risks.
- **Medication Adherence Tracker**: Time-slotted dosage management (Morning, Afternoon, Night) with audible audio chimes, compliance analytics, and doctor-monitored logs.
- **Emergency SOS Dispatcher**: One-tap emergency escalation that instantly triggers hospital emergency command protocols.

### 3. Doctor Clinical Command Center (`:4000/dashboard/index.html`)
- **Live Triage Board**: Color-coded patient priority queue updated via WebSockets.
- **Remote Telemetry Stream**: Side-by-side view of hospital kiosk vitals and home patient RPM logs with interactive Chart.js trend curves.
- **Tele-Consultation & OPD Scheduling**: Direct doctor-patient appointment booking and clinical notes synchronization.

### 4. NOVA Multi-Lingual Clinical Voice Assistant (`:3000`)
- Dual-language conversational voice AI (English & Hindi).
- Direct hardware actuation: voice commands to open/close the kiosk bay door and trigger vitals capture.
- Automated speech suppression during sensitive optical scan intervals to prevent false network timeouts.

---

## 🚀 Unified Services & Port Allocation

| Component | Technology Stack | Port | Description |
|---|---|:---:|---|
| **LifeLine Core Server** | Node.js / Express / Socket.IO / MongoDB | `4000` | Central REST API, database persistence, and WebSocket hub |
| **Patient Terminal UI** | React 19 / Vite / Tailwind CSS | `5173` | Hospital kiosk touchscreen interface |
| **Vital Vision AI Engine** | Python / FastAPI / Groq Vision LLaVA | `8000` | OCR & clinical reading extraction engine |
| **NOVA Voice Assistant** | Node.js / Express / Groq LLM / TTS | `3000` | Voice interaction and natural language hardware control |
| **Node 2 Camera & Climate** | ESP32-CAM (C++ / Arduino / Bit-bang) | `192.168.137.101` | Bio-Optical capture + GPIO 13 DHT11 ambient sensor |
| **Node 3 Kiosk Door** | ESP32 DevKit (C++ / Arduino / Servo) | `192.168.137.102` | GPIO 2 PWM servo motor driver for physical bay |

---

## ⚡ Quick Start & Execution

### Prerequisites
- **Node.js** v18+ and **npm** v9+
- **Python** 3.10+
- **MongoDB** (Local instance on `mongodb://127.0.0.1:27017` or cloud Atlas URI)

### 1. Clone & Configure
```bash
git clone https://github.com/rishabhbartwal182006-hue/lifieline_final.git
cd lifieline_final
```

Create local environment files from the provided examples:
```bash
cp medikiosk/.env.example medikiosk/.env
cp nova-assistant/server/.env.example nova-assistant/server/.env
cp vital_scanner_lab/.env.example vital_scanner_lab/.env
```
*(Add your `GROQ_API_KEY` into `vital_scanner_lab/.env` and `nova-assistant/server/.env`)*

### 2. Install Dependencies
```bash
# Core Backend & Portals
cd medikiosk && npm install

# Patient Terminal Frontend
cd public/patientTerminal && npm install && npm run build

# NOVA Voice Assistant
cd ../../../nova-assistant/server && npm install

# Vital Vision AI Engine
cd ../../vital_scanner_lab && pip install -r requirements.txt
```

### 3. Launch All Services Concurrently
From the project root:
```bash
python run_all.py
```

`run_all.py` automatically initializes and orchestrates all 4 microservices:
- 🌐 **3-Pillar Gateway**: [http://localhost:4000/landingPage.html](http://localhost:4000/landingPage.html)
- 🏥 **Hospital MediKiosk**: [http://localhost:5173](http://localhost:5173) *(or [http://localhost:4000/terminal](http://localhost:4000/terminal))*
- 🏠 **Home Patient 360**: [http://localhost:4000/home-patient](http://localhost:4000/home-patient)
- 🩺 **Doctor Command Center**: [http://localhost:4000/dashboard/index.html](http://localhost:4000/dashboard/index.html)
- 🗣️ **NOVA Voice Assistant**: [http://localhost:3000](http://localhost:3000)

---

## 🔌 Hardware Wiring & IoT Schematics

### Node 2: DHT11 Climate Sensor & Bio-Optical Unit
- **MCU**: ESP32-CAM (AI-Thinker)
- **Firmware**: [`vital_scanner_lab/CameraWebServer_HomeCompanion/`](vital_scanner_lab/CameraWebServer_HomeCompanion/)
- **Pinout**:
  - `VCC` $\rightarrow$ `3.3V` / `5V`
  - `GND` $\rightarrow$ `GND`
  - `DATA` $\rightarrow$ `GPIO 13` *(Bit-bang one-wire timing with zero external libraries)*

### Node 3: Motorized Kiosk Bay Door Controller
- **MCU**: ESP32 DevKit V1 (Standard)
- **Firmware**: [`vital_scanner_lab/ESP32_Kiosk_DoorController/`](vital_scanner_lab/ESP32_Kiosk_DoorController/)
- **Pinout**:
  - `PWM Signal` $\rightarrow$ `GPIO 2`
  - `VCC` $\rightarrow$ `5V / VIN`
  - `GND` $\rightarrow$ `GND`
  - **Open Angle**: $180^\circ$ | **Closed Angle**: $6^\circ$ (with smooth interpolation to prevent current spikes)

---

## 🛡️ Security & Privacy
- **Strict Data Isolation**: Zero default mock data; sensor disconnects output explicit `null` states rather than spoofed values.
- **De-identified Telemetry**: Clinical data packets transmit anonymized patient IDs (`PT-HOME-01`) mapped securely on physician endpoints.
- **Protected Environment Variables**: All confidential API keys and connection credentials reside exclusively in uncommitted `.env` files.

---

## 📄 License & Attribution
Developed for submission by **Rishabh Bartwal** and team. All rights reserved.
For academic, hackathon, and clinical demonstration use.
