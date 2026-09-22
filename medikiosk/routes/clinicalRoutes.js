const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const ProvisionalIntake = require('../models/ProvisionalIntake');
const AuditLog = require('../models/AuditLog');
const hprAuthMiddleware = require('../middleware/hprAuth');
const { convertToFhirR4Bundle, generateFHIRBundle } = require('../services/fhirMapper');
const { syncToAbdmNetwork } = require('../services/abdmSyncService');
const { isMongoConnected, memoryStore } = require('../config/db');
const { interpretVitals, DISCLAIMER } = require('../services/altitudeAdjustmentService');

function extractVitalScalar(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'object') {
    const inner = val.value ?? val.vitalValue;
    return inner !== undefined && inner !== null ? inner : undefined;
  }
  return val;
}

function extractBPValues(vitals) {
  if (!vitals) return { systolic: undefined, diastolic: undefined, stringVal: undefined };

  const rawBp = vitals.bp || vitals.blood_pressure || (typeof vitals.bloodPressure === 'string' ? vitals.bloodPressure : undefined);
  if (typeof rawBp === 'string' && rawBp.includes('/')) {
    const parts = rawBp.split('/');
    return {
      systolic: Number(parts[0]) || parts[0],
      diastolic: Number(parts[1]) || parts[1],
      stringVal: rawBp
    };
  }

  const bpObj = (vitals.bloodPressure && typeof vitals.bloodPressure === 'object') ? vitals.bloodPressure : vitals;
  const sysRaw = bpObj.systolic !== undefined ? bpObj.systolic : (bpObj.systolicBP ?? bpObj.systolic_bp);
  const diaRaw = bpObj.diastolic !== undefined ? bpObj.diastolic : (bpObj.diastolicBP ?? bpObj.diastolic_bp);

  const sys = extractVitalScalar(sysRaw);
  const dia = extractVitalScalar(diaRaw);

  if (sys !== undefined && dia !== undefined) {
    return {
      systolic: sys,
      diastolic: dia,
      stringVal: `${sys}/${dia}`
    };
  }

  return { systolic: undefined, diastolic: undefined, stringVal: undefined };
}

/**
 * Format patient record into Doctor Dashboard Summary & Session structures
 */
function buildDashboardSummary(record) {
  const bpData = extractBPValues(record.vitals);
  const spo2Val = extractVitalScalar(record.vitals?.spo2);
  const hrVal = extractVitalScalar(record.vitals?.heartRate ?? record.vitals?.hr ?? record.vitals?.heart_rate);
  const tempVal = extractVitalScalar(record.vitals?.temperature ?? record.vitals?.temp);
  const glucoseVal = extractVitalScalar(record.vitals?.bloodGlucose ?? record.vitals?.bloodSugar ?? record.vitals?.glucose ?? record.vitals?.blood_glucose);

  const preConsultationSummary = {
    order: ["Vitals", "Chief Complaint", "HPI", "History", "AYUSH parameters"],
    section1_vitals: {
      bloodPressure: bpData.stringVal ? {
        systolic: bpData.systolic,
        diastolic: bpData.diastolic,
        unit: "mmHg",
        provenance: record.vitals?.bloodPressure?.systolic?.provenanceMeta?.provenance || "device-captured",
        confidence: 1.0,
        altitudeContext: record.vitals?.bloodPressure?.systolic?.altitudeContext || null
      } : null,
      spo2: spo2Val !== undefined ? {
        value: spo2Val,
        unit: "%",
        provenance: record.vitals?.spo2?.provenanceMeta?.provenance || "device-captured",
        confidence: 1.0,
        altitudeContext: record.vitals?.spo2?.altitudeContext || null
      } : null,
      heartRate: hrVal !== undefined ? {
        value: hrVal,
        unit: "bpm",
        provenance: record.vitals?.heartRate?.provenanceMeta?.provenance || "device-captured",
        confidence: 1.0,
        altitudeContext: record.vitals?.heartRate?.altitudeContext || null
      } : null,
      temperature: tempVal !== undefined ? {
        value: tempVal,
        unit: "°C",
        provenance: record.vitals?.temperature?.provenanceMeta?.provenance || "device-captured",
        confidence: 1.0,
        altitudeContext: null
      } : null,
      bloodGlucose: glucoseVal !== undefined ? {
        value: glucoseVal,
        unit: "mg/dL",
        provenance: record.vitals?.bloodGlucose?.provenanceMeta?.provenance || "device-captured",
        confidence: 1.0,
        altitudeContext: null
      } : null
    },
    section2_chiefComplaints: (record.chiefComplaints || []).map(cc => ({
      symptom: cc.symptom,
      duration: cc.duration,
      severity: cc.severity,
      provenance: cc.provenanceMeta?.provenance || "patient-spoken",
      confidence: cc.provenanceMeta?.confidence || 0.95
    })),
    section3_hpi: {
      narrative: record.hpi?.narrative || "No detailed HPI narrative available.",
      onset: record.hpi?.onset || "N/A",
      associatedSymptoms: record.hpi?.associatedSymptoms || [],
      provenance: record.hpi?.provenanceMeta?.provenance || "patient-spoken",
      confidence: record.hpi?.provenanceMeta?.confidence || 0.90
    },
    section4_history: {
      pastDiagnoses: record.history?.pastDiagnoses || [],
      allergies: record.history?.allergies || [],
      currentMedications: record.history?.currentMedications || [],
      familyHistory: record.history?.familyHistory || []
    },
    section5_ayushParameters: {
      nadi: record.ayushParameters?.nadi || "N/A",
      jihva: record.ayushParameters?.jihva || "N/A",
      mala: record.ayushParameters?.mala || "N/A",
      mutra: record.ayushParameters?.mutra || "N/A",
      agni: record.ayushParameters?.agni || "N/A",
      koshtha: record.ayushParameters?.koshtha || "N/A",
      sparsha: record.ayushParameters?.sparsha || "N/A",
      drik: record.ayushParameters?.drik || "N/A",
      akriti: record.ayushParameters?.akriti || "N/A",
      vaya: record.ayushParameters?.vaya || "N/A",
      provenance: record.ayushParameters?.provenanceMeta?.provenance || "touch-selected",
      confidence: record.ayushParameters?.provenanceMeta?.confidence || 1.0
    }
  };

  const documentTimeline = (record.ocrDocuments || [])
    .map(doc => ({
      documentId: doc.documentId,
      documentType: doc.documentType,
      extractedDate: doc.extractedDate || "Undated",
      practitionerName: doc.practitionerName || "Unknown Practitioner",
      extractedMedications: doc.extractedMedications || [],
      extractedLabs: doc.extractedLabs || [],
      fileUrl: doc.fileUrl,
      provenance: doc.provenanceMeta?.provenance || "scanned-document",
      confidence: doc.provenanceMeta?.confidence || 0.92
    }))
    .sort((a, b) => new Date(b.extractedDate) - new Date(a.extractedDate));

  const discrepancyFlags = record.discrepancyFlags || [];

  const session = {
    sessionId: record.intakeId,
    patientId: record.abhaId,
    patientName: record.patientDemographics?.fullName,
    age: record.patientDemographics?.age ?? null,
    gender: record.patientDemographics?.gender || null,
    environment: record.environment || {
      altitudeMeters: 2438,
      altitudeFeet: 8000,
      altitudeSource: 'facility_config',
      acclimatizationStatus: 'unacclimatized'
    },
    lastUpdated: record.updatedAt || record.createdAt,
    status: record.status,
    triageResult: {
      triageLevel: record.triage?.triageLevel || 'ROUTINE',
      urgencyScore: record.triage?.urgencyScore || 5,
      recommendedDepartment: record.triage?.recommendedDepartment || 'General Medicine',
      action: record.triage?.protocolNotes || 'Standard Clinical Queue',
      reason: record.hpi?.narrative || 'Kiosk self-service intake completed.',
      triggeredRules: (record.discrepancyFlags || []).map(d => d.message),
      timestamp: record.createdAt
    },
    vitals: {
      HEART_RATE: hrVal !== undefined ? {
        value: hrVal,
        altitudeContext: record.vitals?.heartRate?.altitudeContext || null
      } : null,
      SPO2: spo2Val !== undefined ? {
        value: spo2Val,
        altitudeContext: record.vitals?.spo2?.altitudeContext || null
      } : null,
      BLOOD_PRESSURE: bpData.stringVal ? {
        value: bpData.stringVal,
        altitudeContext: record.vitals?.bloodPressure?.systolic?.altitudeContext || null
      } : null,
      TEMPERATURE: tempVal !== undefined ? {
        value: tempVal,
        altitudeContext: null
      } : null,
      BLOOD_GLUCOSE: glucoseVal !== undefined ? {
        value: glucoseVal,
        altitudeContext: null
      } : null
    },
    symptoms: {
      primary: record.chiefComplaints && record.chiefComplaints[0] ? {
        symptomName: record.chiefComplaints[0].symptom,
        severity: record.chiefComplaints[0].severity === 'Severe' ? 8 : record.chiefComplaints[0].severity === 'Moderate' ? 5 : 3
      } : null,
      list: (record.chiefComplaints || []).map(c => ({
        symptomName: c.symptom,
        severity: c.severity === 'Severe' ? 8 : c.severity === 'Moderate' ? 5 : 3
      }))
    }
  };

  return {
    intakeId: record.intakeId,
    abhaId: record.abhaId,
    patientDemographics: record.patientDemographics,
    environment: record.environment || {
      altitudeMeters: 2438,
      altitudeFeet: 8000,
      altitudeSource: 'facility_config',
      acclimatizationStatus: 'unacclimatized'
    },
    status: record.status,
    triage: record.triage,
    hprSignatureBlock: record.hprSignatureBlock || null,
    preConsultationSummary,
    documentTimeline,
    discrepancyFlags,
    session,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    disclaimer: DISCLAIMER
  };
}

/**
 * GET /api/v1/clinical/patient/:id/summary
 */
router.get('/patient/:id/summary', async (req, res) => {
  try {
    const patientIdentifier = req.params.id;

    let record = null;
    if (isMongoConnected()) {
      record = await ProvisionalIntake.findOne({
        $or: [{ abhaId: patientIdentifier }, { intakeId: patientIdentifier }]
      }).sort({ createdAt: -1 });
    } else {
      record = await memoryStore.findOne('ProvisionalIntake', { abhaId: patientIdentifier }) ||
               await memoryStore.findOne('ProvisionalIntake', { intakeId: patientIdentifier });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "RECORD_NOT_FOUND",
        message: `No clinical intake record found for patient identifier: ${patientIdentifier}`
      });
    }

    const summaryData = buildDashboardSummary(record);

    const auditData = {
      logId: `AUDIT-SUMMARY-${Date.now()}`,
      action: 'DOCTOR_SUMMARY_ACCESSED',
      intakeId: record.intakeId,
      abhaId: record.abhaId,
      performedBy: 'CLINICAL_DASHBOARD',
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date()
    };
    if (isMongoConnected()) {
      await AuditLog.create(auditData);
    } else {
      await memoryStore.save('AuditLog', auditData);
    }

    return res.status(200).json({
      success: true,
      data: summaryData
    });

  } catch (err) {
    console.error(`[Doctor Dashboard API Error]: ${err.message}`, err);
    return res.status(500).json({
      success: false,
      error: "SUMMARY_FETCH_FAILED",
      message: `Failed to fetch clinical dashboard summary: ${err.message}`
    });
  }
});

/**
 * GET /api/events/session/:sessionId
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    let record = null;
    if (isMongoConnected()) {
      record = await ProvisionalIntake.findOne({
        $or: [{ intakeId: sessionId }, { abhaId: sessionId }]
      });
    } else {
      record = await memoryStore.findOne('ProvisionalIntake', { intakeId: sessionId }) ||
               await memoryStore.findOne('ProvisionalIntake', { abhaId: sessionId });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: `Encounter '${sessionId}' not found`
      });
    }

    const summaryData = buildDashboardSummary(record);

    return res.status(200).json({
      success: true,
      session: summaryData.session,
      data: summaryData
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events/sessions
 */
router.get('/sessions', async (req, res) => {
  try {
    let records = [];
    if (isMongoConnected()) {
      records = await ProvisionalIntake.find().sort({ updatedAt: -1 });
    } else {
      records = await memoryStore.find('ProvisionalIntake');
    }

    const sessions = records.map(r => buildDashboardSummary(r).session);

    return res.status(200).json({
      success: true,
      count: sessions.length,
      sessions: sessions
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/events/session/:sessionId/audit
 */
router.get(['/session/:sessionId/audit', '/sessions/:sessionId/audit'], async (req, res) => {
  try {
    const { sessionId } = req.params;
    let logs = [];
    if (isMongoConnected()) {
      logs = await AuditLog.find({ $or: [{ intakeId: sessionId }, { sessionId }] }).sort({ timestamp: -1 });
    } else {
      logs = await memoryStore.find('AuditLog', { $or: [{ intakeId: sessionId }, { sessionId }] });
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    const auditTrail = logs.map(l => ({
      timestamp: l.timestamp,
      eventType: l.action,
      currentLevel: 'PROVISIONAL',
      reason: l.details?.reason || l.action
    }));

    return res.status(200).json({
      success: true,
      sessionId: sessionId,
      count: auditTrail.length,
      auditTrail: auditTrail
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/events/demo/seed
 */
router.post('/demo/seed', async (req, res) => {
  try {
    const mockSeedEncounters = [
      {
        intakeId: "kiosk_sess_seed_01",
        abhaId: "ABHA-8812-ROUTINE-1",
        patientDemographics: { fullName: "Anil Kumar", gender: "M", age: 34 },
        vitals: {
          heartRate: { value: 72, unit: "bpm" },
          spo2: { value: 98, unit: "%" },
          bloodPressure: { systolic: { value: 120 }, diastolic: { value: 80 } }
        },
        chiefComplaints: [{ symptom: "Mild Seasonal Allergies", duration: "2 days", severity: "Mild" }],
        triage: { triageLevel: "ROUTINE", urgencyScore: 3, recommendedDepartment: "General OPD" },
        status: "PROVISIONAL",
        createdAt: new Date(Date.now() - 3600000),
        updatedAt: new Date(Date.now() - 3600000)
      },
      {
        intakeId: "kiosk_sess_seed_02",
        abhaId: "ABHA-7721-URGENT-1",
        patientDemographics: { fullName: "Sunita Verma", gender: "F", age: 52 },
        vitals: {
          heartRate: { value: 154, unit: "bpm" },
          spo2: { value: 92, unit: "%" },
          bloodPressure: { systolic: { value: 145 }, diastolic: { value: 95 } }
        },
        chiefComplaints: [{ symptom: "Tachycardia & Palpitations", duration: "1 hour", severity: "Severe" }],
        triage: { triageLevel: "URGENT", urgencyScore: 8, recommendedDepartment: "Cardiology OPD" },
        status: "PROVISIONAL",
        createdAt: new Date(Date.now() - 1800000),
        updatedAt: new Date(Date.now() - 1800000)
      },
      {
        intakeId: "kiosk_sess_seed_03",
        abhaId: "ABHA-3391-ROUTINE-2",
        patientDemographics: { fullName: "Vikram Singh", gender: "M", age: 29 },
        vitals: {
          heartRate: { value: 78, unit: "bpm" },
          spo2: { value: 99, unit: "%" },
          bloodPressure: { systolic: { value: 122 }, diastolic: { value: 82 } }
        },
        chiefComplaints: [{ symptom: "Skin Rash Localized", duration: "4 hours", severity: "Mild" }],
        triage: { triageLevel: "ROUTINE", urgencyScore: 2, recommendedDepartment: "Dermatology" },
        status: "PROVISIONAL",
        createdAt: new Date(Date.now() - 900000),
        updatedAt: new Date(Date.now() - 900000)
      }
    ];

    for (const enc of mockSeedEncounters) {
      if (isMongoConnected()) {
        await ProvisionalIntake.findOneAndUpdate({ intakeId: enc.intakeId }, enc, { upsert: true });
      } else {
        await memoryStore.save('ProvisionalIntake', enc);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Demo encounters successfully seeded into database queue.",
      count: mockSeedEncounters.length
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * HPR Biometric Write-Lock Commit Handler
 */
async function handleClinicalCommit(req, res) {
  try {
    const { intakeId, sessionId, doctorNotes } = req.body || {};
    const targetId = intakeId || sessionId || req.query.intakeId;
    const hprUser = req.hprUser;

    if (!targetId) {
      return res.status(400).json({
        success: false,
        error: "MISSING_INTAKE_ID",
        message: "intakeId or sessionId is required to commit clinical record."
      });
    }

    let record = null;
    if (isMongoConnected()) {
      record = await ProvisionalIntake.findOne({
        $or: [{ intakeId: targetId }, { abhaId: targetId }]
      });
    } else {
      record = await memoryStore.findOne('ProvisionalIntake', { intakeId: targetId }) ||
               await memoryStore.findOne('ProvisionalIntake', { abhaId: targetId });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "INTAKE_NOT_FOUND",
        message: `No provisional intake record found for ID: ${targetId}`
      });
    }

    if (record.status === 'VERIFIED_COMMITTED') {
      return res.status(409).json({
        success: false,
        error: "ALREADY_COMMITTED",
        message: "Record has already been verified and committed with HPR signature write-lock.",
        data: {
          intakeId: record.intakeId,
          committedAt: record.hprSignatureBlock?.committedAt,
          signature: record.hprSignatureBlock?.digitalSignature
        }
      });
    }

    const timestamp = new Date();
    const signaturePayload = `${record.intakeId}:${record.abhaId}:${hprUser.hprId}:${timestamp.toISOString()}:${process.env.HPR_SECRET || 'hpr_secret_key'}`;
    const digitalSignature = crypto.createHmac('sha256', process.env.HPR_SECRET || 'hpr_secret_key')
      .update(signaturePayload)
      .digest('hex');

    const hprSignatureBlock = {
      hprId: hprUser.hprId,
      doctorName: hprUser.doctorName,
      registrationNumber: hprUser.registrationNumber,
      stateCouncil: hprUser.stateCouncil,
      role: hprUser.role,
      committedAt: timestamp,
      digitalSignature: `SHA256:${digitalSignature}`,
      doctorNotes: doctorNotes || "Verified and approved via HPR biometric authentication."
    };

    record.status = 'VERIFIED_COMMITTED';
    record.hprSignatureBlock = hprSignatureBlock;

    const fhirBundle = convertToFhirR4Bundle(record);
    record.fhirBundle = fhirBundle;

    if (isMongoConnected()) {
      await ProvisionalIntake.updateOne({ intakeId: record.intakeId }, {
        status: 'VERIFIED_COMMITTED',
        hprSignatureBlock,
        fhirBundle
      });
    } else {
      await memoryStore.updateOne('ProvisionalIntake', { intakeId: record.intakeId }, {
        status: 'VERIFIED_COMMITTED',
        hprSignatureBlock,
        fhirBundle
      });
    }

    const abdmSyncResult = await syncToAbdmNetwork(record, fhirBundle);

    const auditData = {
      logId: `AUDIT-COMMIT-${Date.now()}`,
      action: 'WRITE_LOCK_COMMITTED',
      intakeId: record.intakeId,
      abhaId: record.abhaId,
      performedBy: `HPR:${hprUser.hprId}`,
      hprId: hprUser.hprId,
      ipAddress: req.ip || '127.0.0.1',
      details: {
        digitalSignature: `SHA256:${digitalSignature}`,
        abdmTxnId: abdmSyncResult.abdmTransactionId,
        fhirBundleType: fhirBundle.type
      },
      timestamp: timestamp
    };

    if (isMongoConnected()) {
      await AuditLog.create(auditData);
    } else {
      await memoryStore.save('AuditLog', auditData);
    }

    return res.status(200).json({
      success: true,
      message: "Record successfully verified, committed with HPR biometric write-lock, converted to HL7 FHIR (R4) Bundle, and synchronized with ABDM network.",
      data: {
        intakeId: record.intakeId,
        sessionId: record.intakeId,
        abhaId: record.abhaId,
        patientId: record.abhaId,
        status: record.status,
        hprSignatureBlock: record.hprSignatureBlock,
        abdmSync: {
          status: "SUCCESS",
          transactionId: abdmSyncResult.abdmTransactionId,
          compliance: ["M1-ABHA", "M2-DISCOVERY", "M3-HIE-CM"]
        },
        fhirBundleUrl: `/api/v1/clinical/fhir/bundle/${record.intakeId}`
      }
    });

  } catch (err) {
    console.error(`[Clinical Commit Error]: ${err.message}`, err);
    return res.status(500).json({
      success: false,
      error: "COMMIT_FAILED",
      message: `Failed to commit clinical record: ${err.message}`
    });
  }
}

router.post('/commit', hprAuthMiddleware, handleClinicalCommit);
router.post('/approve', hprAuthMiddleware, handleClinicalCommit);
router.post('/doctor/verify', hprAuthMiddleware, handleClinicalCommit);

/**
 * FHIR R4 Bundle Retrieval API
 */
async function handleFhirExport(req, res) {
  try {
    const intakeId = req.params.intakeId || req.params.id;

    // Consent settings from query parameters
    const consentSettings = {
      vitalsOnly: req.query.vitalsOnly === 'true',
      fullHistory: req.query.fullHistory !== 'false',
      ayushNotes: req.query.ayushNotes !== 'false'
    };

    let record = null;
    if (isMongoConnected()) {
      record = await ProvisionalIntake.findOne({
        $or: [{ intakeId: intakeId }, { abhaId: intakeId }]
      });
    } else {
      record = await memoryStore.findOne('ProvisionalIntake', { intakeId: intakeId }) ||
               await memoryStore.findOne('ProvisionalIntake', { abhaId: intakeId });
    }

    if (!record) {
      return res.status(404).json({
        success: false,
        error: "NOT_FOUND",
        message: `Intake record not found for ID: ${intakeId}`
      });
    }

    const bundle = generateFHIRBundle(record, consentSettings);

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.status(200).send(JSON.stringify(bundle, null, 2));

  } catch (err) {
    console.error(`[FHIR Bundle Export Error]: ${err.message}`);
    return res.status(500).json({
      success: false,
      error: "FHIR_EXPORT_FAILED",
      message: `Failed to export FHIR bundle: ${err.message}`
    });
  }
}

router.get('/fhir/bundle/:intakeId', handleFhirExport);
router.get('/export/fhir/:intakeId', handleFhirExport);

/**
 * POST /api/v1/clinical/patient/:id/override-altitude
 * Allows attending physician to override patient altitude context with audit logging
 */
router.post('/patient/:id/override-altitude', async (req, res) => {
  try {
    const patientIdentifier = req.params.id;
    const { altitudeMeters, altitudeSource, overrideReason, doctorNotes, acclimatizationStatus } = req.body || {};

    let record = null;
    if (isMongoConnected()) {
      record = await ProvisionalIntake.findOne({
        $or: [{ abhaId: patientIdentifier }, { intakeId: patientIdentifier }]
      });
    } else {
      record = await memoryStore.findOne('ProvisionalIntake', { abhaId: patientIdentifier }) ||
               await memoryStore.findOne('ProvisionalIntake', { intakeId: patientIdentifier });
    }

    if (!record) {
      return res.status(404).json({ success: false, error: 'RECORD_NOT_FOUND', message: `No record found for ${patientIdentifier}` });
    }

    const meters = typeof altitudeMeters === 'number' ? altitudeMeters : 2438;
    record.environment = {
      altitudeMeters: meters,
      altitudeFeet: Math.round(meters * 3.28084),
      altitudeSource: altitudeSource === 'facility_config' ? 'facility_config' : 'staff_manual',
      altitudeConfidence: 1.0,
      acclimatizationStatus: acclimatizationStatus || 'unacclimatized'
    };

    // Re-run interpretation
    if (record.vitals) {
      const interpreted = interpretVitals(record.vitals, record.environment, record.chiefComplaints);
      interpreted.forEach(it => {
        if (it.type === 'spo2' && record.vitals.spo2) {
          record.vitals.spo2.altitudeContext = {
            altitudeMeters: it.altitudeMeters,
            expectedRange: it.expectedRange,
            status: it.status,
            adjustedForAltitude: it.adjustedForAltitude,
            algorithmVersion: it.algorithmVersion
          };
        }
        if (it.type === 'heart_rate' && record.vitals.heartRate) {
          record.vitals.heartRate.altitudeContext = {
            altitudeMeters: it.altitudeMeters,
            expectedRange: it.expectedRange,
            status: it.status,
            adjustedForAltitude: it.adjustedForAltitude,
            algorithmVersion: it.algorithmVersion
          };
        }
        if (it.type === 'bp_systolic' && record.vitals.bloodPressure?.systolic) {
          record.vitals.bloodPressure.systolic.altitudeContext = {
            altitudeMeters: it.altitudeMeters,
            expectedRange: it.expectedRange,
            status: it.status,
            adjustedForAltitude: it.adjustedForAltitude,
            algorithmVersion: it.algorithmVersion
          };
        }
      });
    }

    if (isMongoConnected()) {
      await ProvisionalIntake.updateOne({ intakeId: record.intakeId }, {
        environment: record.environment,
        vitals: record.vitals
      });
    } else {
      await memoryStore.updateOne('ProvisionalIntake', { intakeId: record.intakeId }, record);
    }

    // Append-only Audit Log
    const auditData = {
      logId: `AUDIT-OVERRIDE-${Date.now()}`,
      action: 'ALTITUDE_INTERPRETATION_OVERRIDDEN',
      intakeId: record.intakeId,
      sessionId: record.sessionId || record.session_id || record.intakeId,
      abhaId: record.abhaId,
      performedBy: req.body.doctorName || 'ATTENDING_PHYSICIAN',
      userId: req.body.hprId || req.body.doctorId || 'DOC-01',
      altitudeMeters: meters,
      altitudeSource: record.environment.altitudeSource,
      algorithmVersion: 'altitude-mvp-v1',
      details: {
        reason: overrideReason || 'Physician adjusted altitude context',
        notes: doctorNotes || ''
      },
      timestamp: new Date()
    };
    if (isMongoConnected()) {
      await AuditLog.create(auditData).catch(() => {});
    } else {
      await memoryStore.save('AuditLog', auditData).catch(() => {});
    }

    const summary = buildDashboardSummary(record);

    const io = req.app.get('io');
    if (io) {
      io.emit('TRIAGE_UPDATED', {
        sessionId: record.intakeId,
        patientId: record.abhaId,
        status: record.status,
        triageResult: summary.session.triageResult
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Altitude interpretation overridden and audit log generated.',
      data: summary
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
module.exports.buildDashboardSummary = buildDashboardSummary;
module.exports.handleClinicalCommit = handleClinicalCommit;
module.exports.handleFhirExport = handleFhirExport;
