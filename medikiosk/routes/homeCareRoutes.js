// ============================================================
//  routes/homeCareRoutes.js
//  LifeLine 360 — Remote Patient Monitoring (RPM) & Home Care
//  Real Live Hardware Readings + Historical Recorded Telemetry
// ============================================================

const express = require('express');
const axios   = require('axios');
const router  = express.Router();
const { medicationStore, getInitialMedications } = require('./medicationRoutes');

const SCANNER_URL = process.env.VITALS_SCANNER_URL || 'http://localhost:8000';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// In-memory store for Remote Patients & their historical vitals telemetry
// Real data only: Starts with clean empty array for vitalsHistory
const remotePatientsStore = new Map();

function initRemotePatients() {
  remotePatientsStore.set('PT-HOME-01', {
    patientId: 'PT-HOME-01',
    name: 'Ramesh Kumar',
    age: 68,
    gender: 'Male',
    primaryDoctor: 'Dr. Ananya Roy, MD',
    clinicAffiliation: 'Apollo MediKiosk Clinical Station',
    condition: 'Type-2 Diabetes & Hypertension',
    caregiverContact: '+91 98765 43210 (Son: Rohit)',
    deviceIP: '192.168.137.101',
    deviceType: 'LifeLine Home Station Node 2',
    deviceStatus: 'Disconnected',
    vitalsHistory: [],
    alerts: [],
    lastSync: null,
    environment: null
  });

  remotePatientsStore.set('PT-HOME-02', {
    patientId: 'PT-HOME-02',
    name: 'Sunita Devi',
    age: 62,
    gender: 'Female',
    primaryDoctor: 'Dr. Ananya Roy, MD',
    clinicAffiliation: 'Apollo MediKiosk Clinical Station',
    condition: 'Post-CABG Cardiac Recovery & COPD',
    caregiverContact: '+91 98111 22334 (Daughter: Priya)',
    deviceIP: '192.168.137.101',
    deviceType: 'LifeLine Home Station Node 2',
    deviceStatus: 'Disconnected',
    vitalsHistory: [],
    alerts: [],
    lastSync: null,
    environment: null
  });
}

initRemotePatients();

// ── GET /api/v1/patient/:patientId/profile ────────────────────
router.get('/:patientId/profile', (req, res) => {
  const { patientId } = req.params;
  let patient = remotePatientsStore.get(patientId);
  if (!patient) {
    patient = {
      patientId,
      name: 'Personal Care Patient',
      age: 60,
      gender: 'Other',
      primaryDoctor: 'Dr. Ananya Roy, MD',
      condition: 'Chronic Care Monitoring',
      deviceIP: '192.168.137.101',
      deviceType: 'LifeLine Home Station Node 2',
      deviceStatus: 'Disconnected',
      vitalsHistory: [],
      alerts: [],
      lastSync: null
    };
    remotePatientsStore.set(patientId, patient);
  }

  // Attach current medication adherence
  const meds = medicationStore.get(patientId) || getInitialMedications(patientId);
  const total = meds.length;
  const taken = meds.filter(m => m.taken).length;
  const complianceRate = total > 0 ? Math.round((taken / total) * 100) : 0;

  return res.json({
    success: true,
    patient: {
      ...patient,
      complianceRate,
      medications: meds
    }
  });
});

// ── GET /api/v1/patient/:patientId/vitals-history ─────────────
router.get('/:patientId/vitals-history', (req, res) => {
  const { patientId } = req.params;
  const patient = remotePatientsStore.get(patientId) || { vitalsHistory: [] };
  return res.json({
    success: true,
    patientId,
    count: patient.vitalsHistory ? patient.vitalsHistory.length : 0,
    vitals: patient.vitalsHistory || []
  });
});

// ── POST /api/v1/patient/:patientId/vitals/scan ───────────────
router.post('/:patientId/vitals/scan', async (req, res) => {
  const { patientId } = req.params;
  const { manual_vital, allow_sample_fallback } = req.body || {};

  let patient = remotePatientsStore.get(patientId);
  if (!patient) {
    patient = {
      patientId,
      name: 'Personal Care Patient',
      age: 65,
      gender: 'Male',
      primaryDoctor: 'Dr. Ananya Roy, MD',
      condition: 'Chronic Care Monitoring',
      deviceIP: '192.168.137.101',
      deviceStatus: 'Disconnected',
      vitalsHistory: [],
      alerts: [],
      lastSync: null
    };
    remotePatientsStore.set(patientId, patient);
  }

  let readingData = null;

  // 1. If user entered a manual vital reading
  if (manual_vital && manual_vital.value) {
    const val = Number(manual_vital.value);
    const vType = manual_vital.vital_type || 'blood_glucose';
    readingData = {
      vital_type: vType,
      value: val,
      secondary_value: manual_vital.secondary_value ? Number(manual_vital.secondary_value) : null,
      unit: manual_vital.unit || (vType === 'blood_pressure' ? 'mmHg' : (vType === 'spo2' ? '%' : (vType === 'heart_rate' ? 'bpm' : 'mg/dL'))),
      confidence: 1.0,
      device_brand: manual_vital.device_brand || 'Home Manual Entry',
      clinical_notes: manual_vital.notes || 'Manually recorded by patient at home'
    };
  } else {
    // 2. Scan from live ESP32-CAM (192.168.137.101) via FastAPI
    try {
      const vType = req.body?.slot_type || 'blood_glucose';
      const response = await axios.post(
        `${SCANNER_URL}/api/scan-internal`,
        {
          api_key: GROQ_API_KEY,
          model: 'qwen/qwen3.8-27b',
          provider: 'groq',
          device_target: 'home',
          esp32_url: 'http://192.168.137.101',
          allow_sample_fallback: allow_sample_fallback === true,
          flip_v: false,
          flip_h: false,
          brightness: 1.0,
          contrast: 1.0,
          sharpness: 1.0,
          expected_type: vType,
          vital_type: vType
        },
        { timeout: 20000 }
      );

      const resData = response.data || {};
      const vitalData = resData.vital || resData.parsed;
      const imageBase64 = resData.image_base64 || resData.enhanced_base64 || null;

      if (vitalData) {
        let extractedVal = vitalData.value;
        if (extractedVal === undefined || extractedVal === null) {
          const rawText = String(vitalData.text_content || vitalData.clinical_notes || '');
          const match = rawText.match(/\d+(\.\d+)?/);
          if (match) extractedVal = Number(match[0]);
        }

        if (extractedVal !== undefined && extractedVal !== null && !isNaN(Number(extractedVal))) {
          readingData = {
            ...vitalData,
            value: Number(extractedVal),
            vital_type: vitalData.vital_type || vType,
            unit: vitalData.unit || (vType === 'blood_pressure' ? 'mmHg' : (vType === 'spo2' ? '%' : 'mg/dL')),
            image: imageBase64
          };
          patient.deviceStatus = 'Connected';
        }
      }

      if (!readingData) {
        return res.status(422).json({
          success: false,
          image: imageBase64,
          error: resData.error || 'Frame captured from camera, but could not detect numeric reading. Please ensure the device screen is bright and directly facing the camera lens.'
        });
      }
    } catch (err) {
      const errMsg = err.response?.data?.detail || err.message;
      patient.deviceStatus = 'Disconnected';
      return res.status(503).json({
        success: false,
        error: `Home ESP32-CAM not connected at 192.168.137.101: ${errMsg}`,
        hint: 'Please connect your ESP32-CAM to Windows hotspot "rish" or switch to "Manual Entry" below to record vitals.'
      });
    }
  }

  // Evaluate clinical status of the REAL reading
  const val = Number(readingData.value);
  const isHighGlucose = readingData.vital_type === 'blood_glucose' && val > 200;
  const isLowGlucose = readingData.vital_type === 'blood_glucose' && val < 70;
  const isHighBP = readingData.vital_type === 'blood_pressure' && val > 160;
  const isLowSpO2 = readingData.vital_type === 'spo2' && val < 92;

  const isAlert = isHighGlucose || isLowGlucose || isHighBP || isLowSpO2;
  const status = isAlert ? 'alert' : 'normal';

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const newRecord = {
    id: `VIT-${patientId}-${Date.now().toString().slice(-5)}`,
    patientId,
    timestamp: now.toISOString(),
    dateLabel: `Today (${timeStr})`,
    vital_type: readingData.vital_type,
    value: val,
    blood_glucose: readingData.vital_type === 'blood_glucose' ? val : null,
    bp_systolic: readingData.vital_type === 'blood_pressure' ? val : null,
    bp_diastolic: readingData.secondary_value || null,
    heart_rate: readingData.vital_type === 'heart_rate' ? val : null,
    spo2: readingData.vital_type === 'spo2' ? val : null,
    temperature: readingData.vital_type === 'temperature' ? val : null,
    unit: readingData.unit,
    device_source: readingData.device_brand || 'Home Station (192.168.137.101)',
    confidence: readingData.confidence,
    clinical_notes: readingData.clinical_notes,
    status
  };

  patient.vitalsHistory.push(newRecord);
  patient.lastSync = now.toISOString();

  // If status is alert, push to patient alerts
  if (status === 'alert') {
    patient.alerts.push({
      id: `ALT-${Date.now()}`,
      type: isHighGlucose ? 'HYPERGLYCEMIA' : (isLowGlucose ? 'HYPOGLYCEMIA' : (isHighBP ? 'HYPERTENSIVE_SPIKE' : 'HYPOXEMIA')),
      message: `Critical vital recorded at home: ${readingData.vital_type} = ${val} ${readingData.unit}`,
      timestamp: now.toISOString(),
      acknowledged: false
    });
  }

  // Broadcast to Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.emit('rpm:vital_sync', {
      patientId,
      patientName: patient.name,
      reading: newRecord,
      status
    });
  }

  return res.status(201).json({
    success: true,
    reading: newRecord,
    image: readingData.image || null,
    status,
    alert: status === 'alert' ? 'Abnormal reading flagged to primary doctor' : null
  });
});

// ── POST /api/v1/patient/:patientId/sos ────────────────────────
router.post('/:patientId/sos', (req, res) => {
  const { patientId } = req.params;
  const { reason } = req.body || {};

  let patient = remotePatientsStore.get(patientId);
  if (!patient) {
    return res.status(404).json({ success: false, error: 'Patient not found' });
  }

  const sosAlert = {
    id: `SOS-${Date.now()}`,
    type: 'EMERGENCY_SOS',
    message: reason || 'Patient triggered Emergency Tele-SOS from Home Care Station!',
    timestamp: new Date().toISOString(),
    severity: 'CRITICAL',
    acknowledged: false
  };

  patient.alerts.unshift(sosAlert);
  patient.deviceStatus = 'SOS ACTIVE';

  // Broadcast to doctor via socket
  const io = req.app.get('io');
  if (io) {
    io.emit('rpm:emergency_sos', {
      patientId,
      patientName: patient.name,
      doctor: patient.primaryDoctor,
      alert: sosAlert
    });
  }

  return res.json({
    success: true,
    message: 'Emergency SOS dispatched to Dr. Ananya Roy & Apollo MediKiosk command center.',
    alert: sosAlert
  });
});

// ── GET /api/v1/patient/:patientId/environment ────────────────
router.get('/:patientId/environment', async (req, res) => {
  const { patientId } = req.params;
  let patient = remotePatientsStore.get(patientId);
  const deviceIP = (patient && patient.deviceIP) || '192.168.137.101';

  try {
    const espRes = await axios.get(`http://${deviceIP}/environment`, { timeout: 2500 });
    const envData = espRes.data || {};

    const isSensorOnline = envData.sensor_online === true && envData.temperature_c !== null && envData.temperature_c !== undefined;

    let result;
    if (isSensorOnline) {
      const tempC = Number(envData.temperature_c);
      const tempF = (envData.temperature_f !== undefined && envData.temperature_f !== null)
        ? Number(envData.temperature_f)
        : Number((tempC * 9 / 5 + 32).toFixed(1));
      const hum = Number(envData.humidity_pct);

      result = {
        success: true,
        online: true,
        temperature_c: tempC,
        temperature_f: tempF,
        humidity_pct: hum,
        sensor_type: 'DHT11',
        gpio: 13,
        device_id: 'LIFELINE-HOME-NODE-02',
        timestamp: new Date().toISOString()
      };

      if (patient) {
        patient.environment = result;
        patient.deviceStatus = 'Connected';
        patient.lastSync = result.timestamp;
      }
    } else {
      result = {
        success: true,
        online: false,
        temperature_c: null,
        temperature_f: null,
        humidity_pct: null,
        sensor_type: 'DHT11',
        gpio: 13,
        device_id: 'LIFELINE-HOME-NODE-02',
        status: 'Awaiting live sensor reading from DHT11 on GPIO 13',
        timestamp: new Date().toISOString()
      };

      if (patient) {
        patient.environment = result;
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('rpm:environment_sync', {
        patientId,
        environment: result
      });
    }

    return res.json(result);
  } catch (err) {
    const result = {
      success: true,
      online: false,
      temperature_c: null,
      temperature_f: null,
      humidity_pct: null,
      sensor_type: 'DHT11',
      gpio: 13,
      device_id: 'LIFELINE-HOME-NODE-02',
      error: 'Device unreachable at http://' + deviceIP + '/environment',
      timestamp: new Date().toISOString()
    };
    if (patient) {
      patient.environment = result;
    }
    return res.json(result);
  }
});

// ── GET /api/v1/doctor/remote-patients ────────────────────────
router.get('/doctor/remote-patients', (req, res) => {
  const patientsList = Array.from(remotePatientsStore.values()).map(p => {
    const meds = medicationStore.get(p.patientId) || getInitialMedications(p.patientId);
    const total = meds.length;
    const taken = meds.filter(m => m.taken).length;
    const complianceRate = total > 0 ? Math.round((taken / total) * 100) : 0;
    const latestVital = p.vitalsHistory && p.vitalsHistory.length > 0
      ? p.vitalsHistory[p.vitalsHistory.length - 1]
      : null;

    return {
      patientId: p.patientId,
      name: p.name,
      age: p.age,
      gender: p.gender,
      condition: p.condition,
      deviceIP: p.deviceIP,
      deviceType: p.deviceType,
      deviceStatus: p.deviceStatus,
      lastSync: p.lastSync,
      complianceRate,
      medicationsSummary: `${taken}/${total} taken today`,
      latestVital,
      environment: p.environment || null,
      activeAlertsCount: (p.alerts || []).filter(a => !a.acknowledged).length,
      alerts: p.alerts || []
    };
  });

  return res.json({
    success: true,
    count: patientsList.length,
    remotePatients: patientsList
  });
});

module.exports = {
  router,
  remotePatientsStore
};
