require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const { Server } = require('socket.io');
const { connectDB, isMongoConnected, memoryStore } = require('./config/db');
const ProvisionalIntake = require('./models/ProvisionalIntake');
const Session = require('./models/Session');
const specAdapter = require('./services/specAdapter');

// Import Routes & Handlers
const kioskRoutes = require('./routes/kioskRoutes');
const clinicalRoutes = require('./routes/clinicalRoutes');
const hprRoutes = require('./routes/hprRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const vitalsRoutes  = require('./routes/vitalsRoutes');
const hprAuthMiddleware = require('./middleware/hprAuth');
const ocrRoutes = require('./routes/ocrRoutes');
const medicationRoutes = require('./routes/medicationRoutes');
const homeCareRoutes = require('./routes/homeCareRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const { evaluateMultiSystemTriage } = require('./services/redFlagRules');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Database Connection
connectDB();

// CORS Configuration - Permissive for Frontend & Socket.IO Clients
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-hpr-token', 'x-requested-with']
}));

// Body Parsers & Morgan Logging
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('dev'));

// Serve Public Static Assets (Kiosk UI at /kiosk.html)
app.use(express.static(path.join(__dirname, 'public')));

// Serve Frontend Command Center Static UI under /dashboard and /triage/dashboard
const dashboardPath = path.join(__dirname, 'triage-engine', 'dashboard');
app.use('/dashboard', express.static(dashboardPath));
app.use('/triage/dashboard', express.static(dashboardPath));

// Direct HTML Shortcut Routes (with strict no-cache headers for instant updates)
app.get(['/', '/index', '/index.html', '/landing', '/landingPage.html'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
app.get('/kiosk', (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'public', 'kiosk.html'));
});
app.get(['/patient-terminal', '/terminal'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'public', 'patientTerminal', 'dist', 'index.html'));
});
app.get(['/home-patient', '/home-care', '/personal-device'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'public', 'homePatient.html'));
});
app.get(['/appointment', '/book-appointment', '/appointment.html'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'public', 'appointment.html'));
});
app.get(['/doctor-dashboard', '/dashboard'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'triage-engine', 'dashboard', 'index.html'));
});
app.get(['/doctor-appointments', '/doctor/appointments', '/appointments', '/appointments.html', '/dashboard/appointments', '/dashboard/appointments.html'], (req, res) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.sendFile(path.join(__dirname, 'triage-engine', 'dashboard', 'appointments.html'));
});

// LifeLine 360 — Home Care & Remote Patient Monitoring (RPM)
app.use('/api/v1/patient', medicationRoutes.router);
app.use('/api/v1/patient', homeCareRoutes.router);
app.use('/api/v1/homecare', homeCareRoutes.router);
app.use('/api/v1', homeCareRoutes.router);

// API Base Routes Mounting
app.use('/api/appointments', appointmentRoutes);
app.use('/api/v1/kiosk', kioskRoutes);
app.use('/api/v1/clinical', clinicalRoutes);
app.use('/api/v1/hpr', hprRoutes);

// openapi-spec-shaped session lifecycle API (/api/v1/sessions/*, /api/v1/auth/staff-login)
// Coexists with the routes above — see services/specAdapter.js for how the two
// data shapes bridge into the same discrepancy/FHIR logic.
app.use('/api/v1', sessionRoutes);

// Vital Scanner — ESP32-CAM + Groq AI glucometer reading
app.use('/api/v1/vitals', vitalsRoutes);
app.use('/api/v1/ocr', ocrRoutes);
// Compatibility Base Routes for Frontend Event APIs (/api/events/...)
app.use('/api/events', kioskRoutes);
app.use('/api/events', clinicalRoutes);

// Specific Direct Endpoint Aliases (Module 5, 6, 7 & Intake Specs)
app.post('/api/v1/intake', kioskRoutes.handleKioskIngestion);
app.post('/api/v1/doctor/verify', hprAuthMiddleware, clinicalRoutes.handleClinicalCommit);
app.get('/api/v1/export/fhir/:intakeId', clinicalRoutes.handleFhirExport);

// GET /api/v1/facility/config
app.get('/api/v1/facility/config', (req, res) => {
  const envAlt = process.env.FACILITY_ALTITUDE_METERS;
  const facilityAltitudeM = envAlt !== undefined && envAlt !== '' && !isNaN(Number(envAlt))
    ? Number(envAlt)
    : null;
  res.json({
    facilityId: process.env.FACILITY_ID || 'KIOSK-FACILITY-01',
    facilityName: process.env.FACILITY_NAME || 'MediKiosk Clinical Station',
    facilityAltitudeM: facilityAltitudeM,
    altitudeConfigured: facilityAltitudeM !== null
  });
});

// In-Memory Patient Submissions Queue
let patientQueue = [];

// POST /api/patient/submit
app.post('/api/patient/submit', (req, res) => {
  const { patientId, name, age, symptoms, vitals, environment, altitudeContext, exposure, hpi, chiefComplaint, chiefComplaints } = req.body || {};

  const generatedId = patientId || `PT-${Date.now().toString().slice(-4)}`;
  const envAlt = process.env.FACILITY_ALTITUDE_METERS;
  const facilityAlt = envAlt !== undefined && envAlt !== '' && !isNaN(Number(envAlt))
    ? Number(envAlt)
    : (environment?.altitudeMeters ?? altitudeContext?.facilityAltitudeM ?? null);

  const patientData = {
    patientId: generatedId,
    name: name || "Anonymous Patient",
    age: age || "—",
    symptoms: Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : [],
    chiefComplaint: chiefComplaint || (Array.isArray(symptoms) && symptoms.length ? symptoms[0] : "General intake"),
    chiefComplaints: chiefComplaints || [],
    hpi: hpi || {},
    altitudeContext: altitudeContext || {
      facilityAltitudeM: facilityAlt,
      exposure: exposure || {}
    },
    environment: environment || { altitudeMeters: facilityAlt, altitudeSource: facilityAlt !== null ? 'facility_config' : 'unconfigured' },
    vitals: vitals || {},
    timestamp: new Date().toISOString()
  };

  // Evaluate clinical triage & multi-system red flags
  const triageResult = evaluateMultiSystemTriage(patientData);

  const newPatient = {
    ...patientData,
    triageLevel: triageResult.triageLevel,
    triage: triageResult.triageLevel,
    urgencyTier: triageResult.urgencyTier,
    urgencyScore: triageResult.urgencyScore,
    redFlags: triageResult.redFlags,
    redFlagCount: triageResult.redFlagCount,
    action: triageResult.action,
    reason: triageResult.reason,
    altitudeContext: triageResult.altitudeContext,
    status: triageResult.triageLevel === 'EMERGENCY' ? 'critical' : 'waiting'
  };

  patientQueue.push(newPatient);

  // Mirror to ProvisionalIntake store so single-session and audit APIs find this encounter
  try {
    const intakeDoc = {
      intakeId: generatedId,
      abhaId: generatedId,
      patientDemographics: {
        fullName: newPatient.name,
        age: newPatient.age,
        gender: req.body?.gender || "M"
      },
      vitals: newPatient.vitals,
      chiefComplaints: (newPatient.symptoms || []).map(s => ({ symptom: s, severity: 'Moderate' })),
      hpi: newPatient.hpi,
      triage: {
        triageLevel: newPatient.triageLevel,
        urgencyScore: newPatient.urgencyScore,
        protocolNotes: newPatient.reason
      },
      redFlags: newPatient.redFlags,
      altitudeContext: newPatient.altitudeContext,
      environment: newPatient.environment,
      status: newPatient.status,
      createdAt: newPatient.timestamp,
      updatedAt: newPatient.timestamp
    };
    if (isMongoConnected()) {
      ProvisionalIntake.findOneAndUpdate({ intakeId: generatedId }, intakeDoc, { upsert: true, new: true }).catch(() => {});
    } else {
      memoryStore.save('ProvisionalIntake', intakeDoc).catch(() => {});
    }
  } catch (err) {
    // Non-blocking in-memory persistence
  }

  // Broadcast to Socket.IO clients if active
  const io = req.app.get('io');
  if (io) {
    io.emit('patient:new', newPatient);
    io.emit('kiosk:intake_submitted', {
      sessionId: newPatient.patientId,
      intakeId: newPatient.patientId,
      patientId: newPatient.patientId,
      patientName: newPatient.name,
      altitude: newPatient.environment?.altitudeMeters ?? newPatient.altitudeContext?.facilityAltitudeM ?? null,
      triageLevel: newPatient.triageLevel,
      urgencyScore: newPatient.urgencyScore,
      redFlags: newPatient.redFlags,
      reason: newPatient.reason,
      status: newPatient.status,
      timestamp: newPatient.timestamp,
      vitals: newPatient.vitals,
      symptoms: newPatient.symptoms
    });

    // If Emergency, immediately trigger Doctor Command Center audio alarm and modal
    if (newPatient.triageLevel === 'EMERGENCY') {
      io.emit('ESCALATION_REQUIRED', {
        sessionId: newPatient.patientId,
        patientId: newPatient.patientId,
        session: { sessionId: newPatient.patientId, patientId: newPatient.patientId },
        patient: newPatient,
        triageLevel: 'EMERGENCY',
        urgencyScore: newPatient.urgencyScore,
        redFlags: newPatient.redFlags,
        reason: newPatient.reason,
        timestamp: newPatient.timestamp
      });
      io.emit('RULE_TRIGGERED', {
        sessionId: newPatient.patientId,
        triageLevel: 'EMERGENCY',
        redFlags: newPatient.redFlags
      });
    }
  }

  return res.status(201).json({
    success: true,
    message: "Patient queued successfully",
    data: newPatient
  });
});

// GET /api/doctor/queue
app.get('/api/doctor/queue', async (req, res) => {
  try {
    let dbRecords = [];
    if (isMongoConnected()) {
      dbRecords = await ProvisionalIntake.find().sort({ updatedAt: -1 });
    } else {
      dbRecords = await memoryStore.find('ProvisionalIntake');
    }

    // Also integrate spec Session records
    try {
      let sessionRecords = [];
      if (isMongoConnected()) {
        sessionRecords = await Session.find().sort({ updated_at: -1 });
      } else {
        sessionRecords = await memoryStore.find('Session');
      }
      for (const sess of sessionRecords) {
        const sessId = sess.session_id;
        if (sessId && !dbRecords.some(r => r.intakeId === sessId || r.abhaId === sessId)) {
          const adapted = specAdapter.sessionToInternalIntake(sess);
          dbRecords.push(adapted);
        }
      }
    } catch (_) {}

    const existingIds = new Set(patientQueue.map(p => p.patientId || p.sessionId || p.id));
    for (const rec of dbRecords) {
      const id = rec.intakeId || rec.abhaId;
      if (!id) continue;

      if (!existingIds.has(id)) {
        patientQueue.push({
          patientId: id,
          sessionId: rec.intakeId || id,
          name: rec.patientDemographics?.fullName || "Anonymous Patient",
          age: rec.patientDemographics?.age || "—",
          gender: rec.patientDemographics?.gender || "M",
          symptoms: (rec.chiefComplaints || []).map(c => c.symptom),
          chiefComplaint: rec.chiefComplaints?.[0]?.symptom || "General intake",
          vitals: rec.vitals || {},
          altitudeContext: rec.altitudeContext || null,
          triageLevel: rec.triage?.triageLevel || 'ROUTINE',
          triage: rec.triage?.triageLevel || 'ROUTINE',
          urgencyScore: rec.triage?.urgencyScore || 3,
          redFlags: rec.redFlags || [],
          status: rec.status || (rec.triage?.triageLevel === 'EMERGENCY' ? 'critical' : 'waiting'),
          timestamp: rec.createdAt || new Date().toISOString()
        });
        existingIds.add(id);
      } else {
        // Update existing queue entry with latest vitals from DB
        const existing = patientQueue.find(p => (p.patientId === id || p.sessionId === id));
        if (existing && rec.vitals) {
          existing.vitals = { ...existing.vitals, ...rec.vitals };
          if (rec.triage?.triageLevel) {
            existing.triageLevel = rec.triage.triageLevel;
            existing.triage = rec.triage.triageLevel;
          }
          if (rec.altitudeContext) existing.altitudeContext = rec.altitudeContext;
          if (rec.redFlags && rec.redFlags.length > 0) existing.redFlags = rec.redFlags;
        }
      }
    }
    // Integrate Remote Home Care Patients into Doctor Command Queue
    try {
      const { remotePatientsStore } = homeCareRoutes;
      if (remotePatientsStore) {
        for (const rp of remotePatientsStore.values()) {
          const id = rp.patientId;
          const latestVital = rp.vitalsHistory && rp.vitalsHistory.length > 0
            ? rp.vitalsHistory[rp.vitalsHistory.length - 1]
            : null;
          const hasActiveSos = (rp.alerts || []).some(a => a.type === 'EMERGENCY_SOS' && !a.acknowledged);
          const hasVitalAlert = (rp.alerts || []).some(a => a.type !== 'EMERGENCY_SOS' && !a.acknowledged);

          const triageLevel = hasActiveSos ? 'EMERGENCY' : (hasVitalAlert ? 'URGENT' : 'ROUTINE');
          const triageStatus = hasActiveSos ? 'critical' : (hasVitalAlert ? 'urgent' : 'waiting');

          const formattedVitals = latestVital ? {
            blood_glucose: latestVital.blood_glucose,
            glucose: latestVital.blood_glucose,
            bloodSugar: `${latestVital.blood_glucose} mg/dL`,
            bp: `${latestVital.bp_systolic}/${latestVital.bp_diastolic}`,
            bp_systolic: latestVital.bp_systolic,
            bp_diastolic: latestVital.bp_diastolic,
            hr: latestVital.heart_rate,
            heart_rate: latestVital.heart_rate,
            spo2: latestVital.spo2,
            temp: latestVital.temperature
          } : {};

          const redFlags = [];
          if (hasActiveSos) redFlags.push('EMERGENCY TELE-SOS ACTIVATED AT HOME');
          if (latestVital && latestVital.blood_glucose > 200) redFlags.push(`Hyperglycemia: ${latestVital.blood_glucose} mg/dL`);
          if (latestVital && latestVital.bp_systolic > 160) redFlags.push(`Hypertensive Crisis: ${latestVital.bp_systolic}/${latestVital.bp_diastolic} mmHg`);

          if (!existingIds.has(id)) {
            patientQueue.push({
              patientId: id,
              sessionId: `HOME-CARE-${id}`,
              name: `[Home Care] ${rp.name}`,
              age: rp.age,
              gender: rp.gender || "M",
              symptoms: [rp.condition],
              chiefComplaint: `Home Remote Monitoring: ${rp.condition}`,
              vitals: formattedVitals,
              altitudeContext: null,
              triageLevel: triageLevel,
              triage: triageLevel,
              urgencyScore: hasActiveSos ? 1 : (hasVitalAlert ? 2 : 4),
              redFlags: redFlags,
              status: triageStatus,
              isRemoteCare: true,
              homeDeviceIP: rp.deviceIP,
              timestamp: rp.lastSync || new Date().toISOString()
            });
            existingIds.add(id);
          } else {
            const existing = patientQueue.find(p => p.patientId === id);
            if (existing) {
              existing.vitals = formattedVitals;
              existing.triageLevel = triageLevel;
              existing.triage = triageLevel;
              existing.status = triageStatus;
              existing.redFlags = redFlags;
              existing.timestamp = rp.lastSync || existing.timestamp;
            }
          }
        }
      }
    } catch (_) {}
  } catch (err) {
    // Graceful fallback to patientQueue
  }

  const priorityOrder = { 'EMERGENCY': 1, 'CRITICAL': 1, 'URGENT': 2, 'ROUTINE': 3 };
  const sortedQueue = [...patientQueue].sort((a, b) => {
    const pA = priorityOrder[a.triageLevel || a.triage] || 99;
    const pB = priorityOrder[b.triageLevel || b.triage] || 99;
    if (pA !== pB) return pA - pB;
    return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
  });
  return res.status(200).json(sortedQueue);
});

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'MediKiosk Unified Backend, Triage Engine & Doctor Command Center',
    port: PORT,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    standards: ['HL7 FHIR R4', 'ABDM M1/M2/M3', 'HPR Biometric Write-Lock', 'Socket.IO Real-Time Stream'],
    kioskUrl: `http://localhost:${PORT}/kiosk.html`,
    dashboardUrl: `http://localhost:${PORT}/dashboard/index.html`
  });
});

// Root Route — Serve Landing Page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Global 404 Handler
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    error: 'ENDPOINT_NOT_FOUND',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    success: false,
    error: 'INTERNAL_SERVER_ERROR',
    message: err.message || 'An unexpected error occurred on the MediKiosk server.'
  });
});

// Create HTTP Server & Attach Socket.IO
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Socket.IO Gateway Event Listeners
io.on('connection', (socket) => {
  console.log(`[Socket.IO] Client connected: ${socket.id}`);

  socket.on('JOIN_DASHBOARD', (data, callback) => {
    socket.join('dashboard');
    console.log(`[Socket.IO] Client ${socket.id} joined 'dashboard' room.`);
    if (typeof callback === 'function') callback({ status: 'OK', room: 'dashboard' });
  });

  socket.on('JOIN_SESSION', (data, callback) => {
    const sessionId = typeof data === 'string' ? data : data?.sessionId;
    if (sessionId) {
      socket.join(`session:${sessionId}`);
      console.log(`[Socket.IO] Client ${socket.id} joined room 'session:${sessionId}'.`);
      if (typeof callback === 'function') callback({ status: 'OK', room: `session:${sessionId}` });
    }
  });

  // Prompt 1 Socket Event Relay: kiosk:intake_submitted
  socket.on('kiosk:intake_submitted', (data) => {
    console.log(`[Socket.IO] Relay 'kiosk:intake_submitted' event for session ${data?.sessionId} (Level: ${data?.triageLevel})`);
    io.emit('kiosk:intake_submitted', data);
  });

  // Prompt 3 Socket Event Relay: EHR_RECORD_COMMITTED
  socket.on('EHR_RECORD_COMMITTED', (data) => {
    console.log(`[Socket.IO] Relay 'EHR_RECORD_COMMITTED' event for session ${data?.sessionId}`);
    io.emit('EHR_RECORD_COMMITTED', data);
  });

  socket.on('PATIENT_EVENT_RECEIVED', (data) => {
    console.log(`[Socket.IO] Patient event received from kiosk for session: ${data?.sessionId}`);
    io.emit('PATIENT_EVENT_RECEIVED', data);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
  });
});

// Attach socket instance to Express app
app.set('io', io);

// Start HTTP & Socket Server
if (require.main === module) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(` MediKiosk Unified Server running on port ${PORT}`);
    console.log(` Landing Page: http://localhost:${PORT}/index.html`);
    console.log(` Patient Intake Kiosk: http://localhost:${PORT}/kiosk.html`);
    console.log(` Doctor Command Center: http://localhost:${PORT}/dashboard/index.html`);
    console.log(` Socket.IO Gateway Active`);
    console.log(` Health Check: http://localhost:${PORT}/health`);
    console.log(`=======================================================`);
  });
}

module.exports = app;
module.exports.httpServer = httpServer;
module.exports.io = io;