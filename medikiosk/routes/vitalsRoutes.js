// ============================================================
//  routes/vitalsRoutes.js
//  MediKiosk — Vital Scanner Integration
//
//  Endpoints:
//    POST /api/v1/vitals/scan    → trigger ESP32 scan + save to session
//    GET  /api/v1/vitals/status  → health check (FastAPI + ESP32)
// ============================================================

const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const Session = require('../models/Session');
const ProvisionalIntake = require('../models/ProvisionalIntake');
const { isMongoConnected, memoryStore } = require('../config/db');
const { analyzeDiscrepancies } = require('../services/discrepancyEngine');
const { detectRedFlags, mergeRedFlags } = require('../services/redFlagRules');
const specAdapter = require('../services/specAdapter');

// ── Config from .env ─────────────────────────────────────────
const SCANNER_URL = process.env.VITALS_SCANNER_URL || 'http://localhost:8000';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

// ── Persistence helpers (same pattern as sessionRoutes.js) ───
async function findSession(sessionId) {
  if (isMongoConnected()) return Session.findOne({ session_id: sessionId });
  return memoryStore.findOne('Session', { session_id: sessionId });
}

async function saveSession(sessionDoc) {
  if (isMongoConnected()) return sessionDoc.save();
  return memoryStore.updateOne(
    'Session',
    { session_id: sessionDoc.session_id },
    sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc
  );
}

async function findProvisionalIntake(id) {
  if (isMongoConnected()) {
    return ProvisionalIntake.findOne({ $or: [{ intakeId: id }, { abhaId: id }] });
  }
  return (await memoryStore.findOne('ProvisionalIntake', { intakeId: id })) ||
         (await memoryStore.findOne('ProvisionalIntake', { abhaId: id }));
}

async function saveProvisionalIntake(doc) {
  if (isMongoConnected()) {
    return ProvisionalIntake.findOneAndUpdate(
      { intakeId: doc.intakeId },
      doc,
      { upsert: true, new: true }
    );
  }
  return memoryStore.save('ProvisionalIntake', doc);
}

// ── Clinical checks (same as sessionRoutes.js) ───────────────
function recomputeClinicalChecks(sessionDoc) {
  const internalPayload = specAdapter.sessionToInternalIntake(sessionDoc);
  const autoFlags = analyzeDiscrepancies(internalPayload);
  const specFlags = specAdapter.internalDiscrepanciesToSpec(autoFlags);

  const existingByRef = new Map(
    (sessionDoc.cross_check_discrepancies || []).map(d => [d.discrepancy_id, d])
  );
  for (const f of specFlags) {
    if (!existingByRef.has(f.discrepancy_id)) existingByRef.set(f.discrepancy_id, f);
  }
  sessionDoc.cross_check_discrepancies = Array.from(existingByRef.values());

  const newRedFlags = detectRedFlags(sessionDoc);
  sessionDoc.red_flags = mergeRedFlags(sessionDoc.red_flags || [], newRedFlags);

  const hasActiveUrgent = sessionDoc.red_flags.some(
    f => f.status === 'active' && (f.urgency_tier === 'critical' || f.urgency_tier === 'urgent')
  );
  if (hasActiveUrgent && ['draft', 'in_progress'].includes(sessionDoc.status)) {
    sessionDoc.status = 'red_flagged';
  }
}

// ══════════════════════════════════════════════════════════════
//  POST /api/v1/vitals/scan
//  Body: { session_id: "abc123" }
//
//  1. Calls FastAPI /api/scan-internal
//  2. Gets glucose reading from Groq (qwen/qwen3.8-27b)
//  3. Pushes VitalReading into session.vitals[]
//  4. Returns { success, reading, session_id }
// ══════════════════════════════════════════════════════════════
router.post('/scan', async (req, res) => {
  const { session_id, vital_type, expected_type } = req.body;
  const requestedType = expected_type || vital_type || 'blood_glucose';

  if (!session_id) {
    return res.status(400).json({ success: false, error: 'session_id is required' });
  }

  // 1. Find or auto-create session
  let sessionDoc;
  try {
    sessionDoc = await findSession(session_id);
    if (!sessionDoc) {
      // Auto-create provisional session doc so scan succeeds even before intake is fully committed
      sessionDoc = new Session({
        session_id: session_id,
        kiosk_id: 'KIOSK-01',
        facility_id: 'FACILITY-01',
        status: 'draft',
        vitals: []
      });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: `DB error: ${err.message}` });
  }

  // 2. Call FastAPI scanner microservice
  let scanResult;
  try {
    const response = await axios.post(
      `${SCANNER_URL}/api/scan-internal`,
      {
        api_key: GROQ_API_KEY,
        model: 'qwen/qwen3.8-27b',
        provider: 'groq',
        device_target: req.body.device_target || (req.body.source === 'home' ? 'home' : 'hospital'),
        expected_type: requestedType,
        vital_type: requestedType
      },
      { timeout: 45000 }
    );
    scanResult = response.data;
  } catch (err) {
    const detail = err.response?.data?.detail || err.message;
    return res.status(502).json({
      success: false,
      error: `Vitals scanner error: ${detail}`,
      hint: 'Make sure FastAPI is running at ' + SCANNER_URL
    });
  }

  if (!scanResult.success || !scanResult.vital) {
    return res.status(422).json({
      success: false,
      error: scanResult.error || 'AI could not extract a reading from the image',
      raw: scanResult
    });
  }

  const vital = scanResult.vital;

  // 3. Build valid numeric VitalReading entries matching Session.js schema
  const readingsToAdd = [];
  const rawType = String(vital.vital_type || requestedType || '').toLowerCase();
  const rawVal = vital.value;

  const isBP = rawType.includes('bp') || rawType.includes('blood_pressure') || (typeof rawVal === 'string' && rawVal.includes('/'));
  const isSpO2 = rawType.includes('spo2') || rawType.includes('oximeter');
  const isHR = rawType.includes('heart_rate') || rawType.includes('pulse');
  const isGlucose = rawType.includes('glucose') || rawType.includes('sugar');
  const isTemp = rawType.includes('temp');

  let sysVal, diaVal, spo2Val, hrVal, glucoseVal, tempVal;

  if (isBP) {
    if (vital.systolic && vital.diastolic) {
      sysVal = Number(vital.systolic);
      diaVal = Number(vital.diastolic);
    } else if (typeof rawVal === 'string' && rawVal.includes('/')) {
      const parts = rawVal.split('/');
      sysVal = Number(parts[0].replace(/[^\d.]/g, ''));
      diaVal = Number(parts[1]?.replace(/[^\d.]/g, ''));
    } else if (typeof rawVal === 'number') {
      sysVal = rawVal;
    }

    if (!isNaN(sysVal) && sysVal > 0) {
      readingsToAdd.push({
        type: 'bp_systolic',
        value: sysVal,
        unit: 'mmHg',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }
    if (!isNaN(diaVal) && diaVal > 0) {
      readingsToAdd.push({
        type: 'bp_diastolic',
        value: diaVal,
        unit: 'mmHg',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }

    const pulse = Number(vital.pulse || vital.heart_rate);
    if (!isNaN(pulse) && pulse > 0) {
      hrVal = pulse;
      readingsToAdd.push({
        type: 'heart_rate',
        value: hrVal,
        unit: 'bpm',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }
  } else if (isSpO2) {
    spo2Val = Number(String(rawVal).replace(/[^\d.]/g, ''));
    if (!isNaN(spo2Val) && spo2Val > 0) {
      readingsToAdd.push({
        type: 'spo2',
        value: spo2Val,
        unit: '%',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }

    const pulse = Number(vital.pulse || vital.heart_rate);
    if (!isNaN(pulse) && pulse > 0) {
      hrVal = pulse;
      readingsToAdd.push({
        type: 'heart_rate',
        value: hrVal,
        unit: 'bpm',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }
  } else if (isHR) {
    hrVal = Number(String(rawVal).replace(/[^\d.]/g, ''));
    if (!isNaN(hrVal) && hrVal > 0) {
      readingsToAdd.push({
        type: 'heart_rate',
        value: hrVal,
        unit: 'bpm',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }
  } else if (isGlucose) {
    glucoseVal = parseFloat(String(rawVal).replace(/[^\d.]/g, ''));
    if (!isNaN(glucoseVal) && glucoseVal > 0) {
      readingsToAdd.push({
        type: 'blood_glucose',
        value: glucoseVal,
        unit: vital.unit || 'mg/dL',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.reading_status === 'memory_recall'
          ? `Memory recall reading. ${vital.clinical_notes || ''}`
          : vital.clinical_notes || ''
      });
    }
  } else if (isTemp) {
    tempVal = parseFloat(String(rawVal).replace(/[^\d.]/g, ''));
    if (!isNaN(tempVal) && tempVal > 0) {
      readingsToAdd.push({
        type: 'temperature',
        value: tempVal,
        unit: vital.unit || '°C',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
    }
  } else {
    // Default safe fallback
    const num = parseFloat(String(rawVal).replace(/[^\d.]/g, ''));
    if (!isNaN(num)) {
      readingsToAdd.push({
        type: 'blood_glucose',
        value: num,
        unit: vital.unit || 'mg/dL',
        source: 'device',
        confidence: vital.confidence || 0.98,
        recorded_at: new Date(),
        notes: vital.clinical_notes || ''
      });
      glucoseVal = num;
    }
  }

  // 4. Push into session + recompute clinical flags
  if (!sessionDoc.vitals) sessionDoc.vitals = [];
  sessionDoc.vitals.push(...readingsToAdd);

  try {
    recomputeClinicalChecks(sessionDoc);
  } catch (_) {
    // Non-fatal — don't block saving if clinical check fails
  }

  try {
    await saveSession(sessionDoc);
  } catch (err) {
    return res.status(500).json({ success: false, error: `Failed to save session: ${err.message}` });
  }

  // 5. Mirror to ProvisionalIntake for Doctor Dashboard queue
  try {
    let intakeDoc = await findProvisionalIntake(session_id);
    if (!intakeDoc) {
      intakeDoc = {
        intakeId: session_id,
        abhaId: sessionDoc.patient?.abha_id || session_id,
        status: 'PROVISIONAL',
        patientDemographics: {
          fullName: sessionDoc.patient?.name || 'Kiosk Patient',
          age: sessionDoc.patient?.age || '—',
          gender: sessionDoc.patient?.gender || 'O'
        },
        vitals: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }
    if (!intakeDoc.vitals) intakeDoc.vitals = {};
    if (sysVal && diaVal) {
      intakeDoc.vitals.bp = `${sysVal}/${diaVal}`;
      intakeDoc.vitals.systolic = sysVal;
      intakeDoc.vitals.diastolic = diaVal;
      intakeDoc.vitals.bloodPressure = {
        systolic: { value: sysVal, unit: 'mmHg', provenanceMeta: { provenance: 'device-captured', confidence: 0.99, timestamp: new Date() } },
        diastolic: { value: diaVal, unit: 'mmHg', provenanceMeta: { provenance: 'device-captured', confidence: 0.99, timestamp: new Date() } }
      };
    }
    if (spo2Val) {
      intakeDoc.vitals.spo2 = { value: spo2Val, unit: '%', provenanceMeta: { provenance: 'device-captured', confidence: 0.98, timestamp: new Date() } };
    }
    if (hrVal) {
      intakeDoc.vitals.hr = hrVal;
      intakeDoc.vitals.heartRate = { value: hrVal, unit: 'bpm', provenanceMeta: { provenance: 'device-captured', confidence: 0.98, timestamp: new Date() } };
    }
    if (glucoseVal) {
      intakeDoc.vitals.glucose = glucoseVal;
      intakeDoc.vitals.bloodSugar = `${glucoseVal} mg/dL`;
      intakeDoc.vitals.bloodGlucose = { value: glucoseVal, unit: 'mg/dL', provenanceMeta: { provenance: 'device-captured', confidence: 0.96, timestamp: new Date() } };
    }
    if (tempVal) {
      intakeDoc.vitals.temp = tempVal;
      intakeDoc.vitals.temperature = { value: tempVal, unit: '°C', provenanceMeta: { provenance: 'device-captured', confidence: 0.98, timestamp: new Date() } };
    }
    intakeDoc.updatedAt = new Date();
    await saveProvisionalIntake(intakeDoc);
  } catch (_) {
    // Non-fatal if mirroring fails
  }

  // 6. Broadcast real-time Socket.IO notification to Doctor Dashboard
  try {
    const io = req.app.get('io');
    if (io) {
      io.emit('kiosk:vital_scanned', {
        sessionId: session_id,
        reading: vital
      });
      io.emit('PATIENT_EVENT_RECEIVED', {
        sessionId: session_id
      });
      io.emit('TRIAGE_UPDATED', {
        sessionId: session_id
      });
    }
  } catch (_) {}

  // 7. Return clean response to frontend
  const primaryType = isBP ? 'blood_pressure'
    : isSpO2 ? 'spo2'
    : isHR ? 'heart_rate'
    : isGlucose ? 'blood_glucose'
    : isTemp ? 'temperature'
    : (vital.vital_type || requestedType || 'blood_glucose');

  const primaryVal = (isBP && sysVal && diaVal) ? `${sysVal}/${diaVal}` : vital.value;

  return res.json({
    success: true,
    session_id,
    reading: {
      type: primaryType,
      value: primaryVal,
      unit: vital.unit || (isBP ? 'mmHg' : isSpO2 ? '%' : isHR ? 'bpm' : isGlucose ? 'mg/dL' : ''),
      confidence: vital.confidence || 0.98,
      reading_status: vital.reading_status,
      device: `${vital.device_brand || ''} ${vital.device_model || ''}`.trim(),
      clinical_notes: vital.clinical_notes,
      is_memory: vital.reading_status === 'memory_recall',
      systolic: sysVal || undefined,
      diastolic: diaVal || undefined,
      pulse: hrVal || undefined,
      spo2: spo2Val || undefined,
      glucose: glucoseVal || undefined
    },
    timing: scanResult.timing
  });
});

// ══════════════════════════════════════════════════════════════
//  GET /api/v1/vitals/status
//  Returns health of FastAPI scanner + ESP32-CAM
// ══════════════════════════════════════════════════════════════
router.get('/status', async (req, res) => {
  const target = req.query.target || 'hospital';
  let scannerOnline = false;
  let esp32Online   = false;
  let esp32Ip       = target === 'home' ? 'http://192.168.137.101' : (process.env.ESP32_URL || 'http://192.168.137.100');

  // Check FastAPI
  try {
    const r = await axios.get(`${SCANNER_URL}/health`, { timeout: 2000 });
    scannerOnline = r.status === 200;
  } catch (_) {
    scannerOnline = false;
  }

  // Check ESP32 via FastAPI proxy
  if (scannerOnline) {
    try {
      const r = await axios.get(`${SCANNER_URL}/api/esp32-status?target=${target}`, { timeout: 3000 });
      esp32Online = r.data?.online === true;
      if (r.data?.url) esp32Ip = r.data.url;
    } catch (_) {
      esp32Online = false;
    }
  }

  return res.json({
    success: true,
    target,
    scanner_online: scannerOnline,
    esp32_online: esp32Online,
    esp32_url: esp32Ip,
    scanner_url: SCANNER_URL
  });
});

module.exports = router;
