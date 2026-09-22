const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const Session = require('../models/Session');
const HprAuthToken = require('../models/HprAuthToken');
const ProvisionalIntake = require('../models/ProvisionalIntake');
const AuditLog = require('../models/AuditLog');
const { isMongoConnected, memoryStore } = require('../config/db');
const { requireBearerToken } = require('../middleware/specAuth');
const { analyzeDiscrepancies } = require('../services/discrepancyEngine');
const { convertToFhirR4Bundle } = require('../services/fhirMapper');
const specAdapter = require('../services/specAdapter');
const { detectRedFlags, mergeRedFlags } = require('../services/redFlagRules');
const { interpretVitals, DISCLAIMER } = require('../services/altitudeAdjustmentService');

// ---- persistence helpers (mirrors the Mongo/in-memory fallback pattern already used elsewhere in this repo) ----

async function findSession(sessionId) {
  if (isMongoConnected()) return Session.findOne({ session_id: sessionId });
  return memoryStore.findOne('Session', { session_id: sessionId });
}

async function saveSession(sessionDoc) {
  if (isMongoConnected()) return sessionDoc.save();
  return memoryStore.updateOne('Session', { session_id: sessionDoc.session_id }, sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc);
}

function asPlain(sessionDoc) {
  return sessionDoc.toObject ? sessionDoc.toObject() : sessionDoc;
}

/** Recompute cross_check_discrepancies + red_flags from current intake/vitals/documents,
 * and bump session.status to red_flagged if something urgent/critical just fired. */
function recomputeClinicalChecks(sessionDoc, io) {
  const internalPayload = specAdapter.sessionToInternalIntake(sessionDoc);

  const autoFlags = analyzeDiscrepancies(internalPayload);
  const specFlags = specAdapter.internalDiscrepanciesToSpec(autoFlags);
  const existingByRef = new Map((sessionDoc.cross_check_discrepancies || []).map(d => [d.discrepancy_id, d]));
  for (const f of specFlags) {
    if (!existingByRef.has(f.discrepancy_id)) existingByRef.set(f.discrepancy_id, f);
  }
  sessionDoc.cross_check_discrepancies = Array.from(existingByRef.values());

  const newRedFlags = detectRedFlags(sessionDoc);
  sessionDoc.red_flags = mergeRedFlags(sessionDoc.red_flags || [], newRedFlags);

  const hasActiveUrgentOrCritical = sessionDoc.red_flags.some(
    f => f.status === 'active' && (f.urgency_tier === 'critical' || f.urgency_tier === 'urgent')
  );
  if (hasActiveUrgentOrCritical && ['draft', 'in_progress'].includes(sessionDoc.status)) {
    sessionDoc.status = 'red_flagged';
  }

  if (io && newRedFlags.length) {
    io.emit('TRIAGE_UPDATED', {
      sessionId: sessionDoc.session_id,
      status: sessionDoc.status,
      redFlags: newRedFlags
    });

  }

  for (const flag of newRedFlags) {
    if (flag.altitude_context) {
      const auditData = {
        logId: `AUDIT-RED-FLAG-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
        action: 'ALTITUDE_RED_FLAG_TRIGGERED',
        sessionId: sessionDoc.session_id,
        intakeId: sessionDoc.intakeId || sessionDoc.intake_id || sessionDoc.session_id,
        performedBy: 'SYSTEM_TRIAGE',
        altitudeMeters: flag.altitude_context.altitudeMeters,
        altitudeSource: sessionDoc.environment?.altitudeSource || 'facility_config',
        algorithmVersion: flag.altitude_context.algorithmVersion || 'altitude-mvp-v1',
        details: { flag },
        timestamp: new Date()
      };
      if (isMongoConnected()) {
        AuditLog.create(auditData).catch(() => {});
      } else {
        memoryStore.save('AuditLog', auditData).catch(() => {});
      }
    }
  }
}

function notFound(res, message = 'Session not found') {
  return res.status(404).json({ code: 'NOT_FOUND', message });
}

// ============================= Sessions =============================

// POST /sessions
router.post('/sessions', requireBearerToken, async (req, res) => {
  try {
    const { kiosk_id, facility_id, language, input_mode, patient } = req.body || {};
    if (!kiosk_id || !facility_id || !language) {
      return res.status(400).json({ code: 'BAD_REQUEST', message: 'kiosk_id, facility_id and language are required.' });
    }

    const sessionData = {
      schema_version: '1.0.0',
      session_id: crypto.randomUUID(),
      kiosk_id,
      facility_id,
      language,
      input_mode: input_mode || 'touch',
      patient: patient || {},
      status: 'draft'
    };

    let saved;
    if (isMongoConnected()) {
      saved = await Session.create(sessionData);
    } else {
      saved = await memoryStore.save('Session', new Session(sessionData).toObject());
    }

    return res.status(201).json(asPlain(saved));
  } catch (err) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: err.message });
  }
});

// GET /sessions/:sessionId
router.get('/sessions/:sessionId', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session));
});

// PATCH /sessions/:sessionId
router.patch('/sessions/:sessionId', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  if (req.body?.status) session.status = req.body.status;
  if (req.body?.consent) session.consent = req.body.consent;

  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved));
});

// ============================= Intake =============================

router.get('/sessions/:sessionId/intake', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).intake || {});
});

router.put('/sessions/:sessionId/intake', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  session.intake = req.body || {};
  if (session.status === 'draft') session.status = 'in_progress';
  recomputeClinicalChecks(session, req.app.get('io'));

  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved).intake);
});

// ============================= Vitals =============================

router.get('/sessions/:sessionId/vitals', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).vitals || []);
});

router.post('/sessions/:sessionId/vitals', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const reading = {
    ...req.body,
    source: req.body?.source || 'staff_manual_entry',
    captured_at: req.body?.captured_at || new Date(),
    confidence: req.body?.confidence ?? 1.0
  };
  const incomingVitals = Array.isArray(req.body) ? req.body.map(r => ({ ...r, source: r.source || 'staff_manual_entry', captured_at: r.captured_at || new Date(), confidence: r.confidence ?? 1.0 })) : [reading];
  session.vitals = [...(session.vitals || []), ...incomingVitals];
  if (session.status === 'draft') session.status = 'in_progress';
  recomputeClinicalChecks(session, req.app.get('io'));

  const saved = await saveSession(session);
  const savedReading = asPlain(saved).vitals.slice(-1)[0];
  return res.status(201).json(Array.isArray(req.body) ? asPlain(saved).vitals.slice(-incomingVitals.length) : savedReading);
});

// GET /sessions/:sessionId/vitals/interpreted
router.get('/sessions/:sessionId/vitals/interpreted', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const plain = asPlain(session);
  const environment = plain.environment || { altitudeMeters: 2438, altitudeSource: 'facility_config' };
  const interpreted = interpretVitals(plain.vitals, environment, plain.intake);

  return res.status(200).json({
    success: true,
    sessionId: plain.session_id,
    environment,
    interpretedVitals: interpreted,
    disclaimer: DISCLAIMER
  });
});

// POST /sessions/:sessionId/environment
router.post('/sessions/:sessionId/environment', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const {
    altitudeMeters,
    altitudeFeet,
    altitudeSource,
    altitudeConfidence,
    timeAtAltitudeHours,
    residenceAltitudeMeters,
    acclimatizationStatus
  } = req.body || {};

  const meters = typeof altitudeMeters === 'number' ? altitudeMeters : 2438;
  const feet = typeof altitudeFeet === 'number' ? altitudeFeet : Math.round(meters * 3.28084);

  session.environment = {
    altitudeMeters: meters,
    altitudeFeet: feet,
    altitudeSource: altitudeSource === 'facility_config' ? 'facility_config' : 'staff_manual',
    altitudeConfidence: altitudeConfidence ?? 1.0,
    timeAtAltitudeHours: timeAtAltitudeHours ?? null,
    residenceAltitudeMeters: residenceAltitudeMeters ?? null,
    acclimatizationStatus: acclimatizationStatus || 'unacclimatized'
  };

  recomputeClinicalChecks(session, req.app.get('io'));
  const saved = await saveSession(session);

  // Log audit trail
  const auditData = {
    logId: `AUDIT-ALT-${Date.now()}`,
    action: 'ALTITUDE_CONTEXT_APPLIED',
    sessionId: session.session_id,
    intakeId: session.intakeId || session.intake_id || session.session_id,
    performedBy: req.staffUser?.hpr_id || 'KIOSK_TERMINAL',
    altitudeMeters: meters,
    altitudeSource: session.environment.altitudeSource,
    algorithmVersion: 'altitude-mvp-v1',
    details: { environment: session.environment },
    timestamp: new Date()
  };
  if (isMongoConnected()) {
    await AuditLog.create(auditData).catch(() => {});
  } else {
    await memoryStore.save('AuditLog', auditData).catch(() => {});
  }

  return res.status(200).json({
    success: true,
    message: 'Environment altitude context updated successfully.',
    environment: asPlain(saved).environment,
    vitals: asPlain(saved).vitals,
    disclaimer: DISCLAIMER
  });
});

// ============================= Documents =============================
// NOTE: real OCR isn't part of this backend (that's Task 2's workstream).
// This accepts a JSON body with document metadata + already-extracted
// fields (matching example-session.json's shape) rather than true
// multipart file upload — see README addendum for details.

router.get('/sessions/:sessionId/documents', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).documents || []);
});

router.post('/sessions/:sessionId/documents', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const { document_type, scan_method, raw_image_ref, ocr_engine, document_date, extracted_fields } = req.body || {};
  if (!document_type || !scan_method) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'document_type and scan_method are required.' });
  }

  const doc = {
    document_id: `DOC-${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(3).toString('hex')}`,
    document_type,
    scan_method,
    uploaded_at: new Date(),
    document_date: document_date || null,
    raw_image_ref: raw_image_ref || null,
    ocr_engine: ocr_engine || null,
    extracted_fields: extracted_fields || [],
    fhir_resource_ref: null
  };

  session.documents = [...(session.documents || []), doc];
  recomputeClinicalChecks(session, req.app.get('io'));

  const saved = await saveSession(session);
  return res.status(202).json(asPlain(saved).documents.slice(-1)[0]);
});

router.get('/sessions/:sessionId/documents/:documentId', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  const doc = (asPlain(session).documents || []).find(d => d.document_id === req.params.documentId);
  if (!doc) return notFound(res, 'Document not found');
  return res.status(200).json(doc);
});

// ============================= Discrepancies =============================

router.get('/sessions/:sessionId/discrepancies', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).cross_check_discrepancies || []);
});

// ============================= Red flags =============================

router.get('/sessions/:sessionId/red-flags', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).red_flags || []);
});

router.post('/sessions/:sessionId/red-flags/:flagId/acknowledge', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const { status } = req.body || {};
  if (!['acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ code: 'BAD_REQUEST', message: 'status must be acknowledged or resolved.' });
  }

  const flags = asPlain(session).red_flags || [];
  const flag = flags.find(f => f.flag_id === req.params.flagId);
  if (!flag) return notFound(res, 'Red flag not found');
  flag.status = status;
  session.red_flags = flags;

  const stillActiveUrgent = flags.some(f => f.status === 'active' && (f.urgency_tier === 'critical' || f.urgency_tier === 'urgent'));
  if (!stillActiveUrgent && session.status === 'red_flagged') {
    session.status = 'in_progress';
  }

  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved).red_flags.find(f => f.flag_id === req.params.flagId));
});

// ============================= Staff auth & write-lock =============================

// POST /auth/staff-login — public per spec (security: [])
router.post('/auth/staff-login', async (req, res) => {
  try {
    const { method, hpr_id, webauthn_assertion } = req.body || {};
    if (!method) return res.status(400).json({ code: 'BAD_REQUEST', message: 'method is required.' });
    if (method === 'biometric' && !webauthn_assertion) {
      return res.status(401).json({ message: 'webauthn_assertion is required for biometric login.' });
    }

    const staffHprId = hpr_id || `HPR-TEMP-${crypto.randomBytes(4).toString('hex')}`;
    const token = `SESS_BEARER_${crypto.randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);

    const tokenDoc = {
      hprId: staffHprId,
      doctorName: staffHprId,
      registrationNumber: staffHprId,
      role: 'CLINICIAN',
      token,
      biometricVerified: method === 'biometric',
      status: 'ACTIVE',
      expiresAt
    };

    if (isMongoConnected()) {
      await HprAuthToken.findOneAndUpdate({ hprId: staffHprId }, tokenDoc, { upsert: true, new: true });
    } else {
      await memoryStore.save('HprAuthToken', tokenDoc);
    }

    return res.status(200).json({
      access_token: token,
      staff_hpr_id: staffHprId,
      expires_in: 12 * 60 * 60
    });
  } catch (err) {
    return res.status(401).json({ message: err.message });
  }
});

// POST /sessions/:sessionId/staff-verification
router.post('/sessions/:sessionId/staff-verification', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  if (session.staff_verification?.verified) {
    return res.status(409).json({ code: 'ALREADY_VERIFIED', message: 'Session already verified.' });
  }

  const { staff_hpr_id, verification_method } = req.body || {};
  session.staff_verification = {
    verified: true,
    staff_hpr_id: staff_hpr_id || req.staff?.hprId || null,
    verification_method: verification_method || 'hpr_credential_login',
    verified_at: new Date()
  };
  if (session.status !== 'red_flagged') session.status = 'staff_verified';
  if (!session.clinical_summary || !session.clinical_summary.signed_by_hpr_id) {
    session.clinical_summary = {
      ...(session.clinical_summary || {}),
      signed_by_hpr_id: staff_hpr_id || req.staff?.hprId || 'HPR-IN-9876543210',
      signed_at: new Date(),
      doctor_notes: req.body?.doctor_notes || 'Verified by clinical staff'
    };
  }

  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved).staff_verification);
});

// ============================= Clinical summary =============================

router.get('/sessions/:sessionId/clinical-summary', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).clinical_summary || {});
});

router.put('/sessions/:sessionId/clinical-summary', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  if (!session.staff_verification?.verified) {
    return res.status(412).json({ code: 'NOT_STAFF_VERIFIED', message: 'Session not yet staff-verified; cannot open for physician review.' });
  }

  session.clinical_summary = { ...asPlain(session).clinical_summary, ...req.body };
  if (session.clinical_summary.signed_by_hpr_id && session.clinical_summary.signed_at) {
    session.status = 'physician_reviewed';
  }

  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved).clinical_summary);
});

// ============================= FHIR / ABDM sync =============================

router.post('/sessions/:sessionId/fhir-sync', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  const summary = asPlain(session).clinical_summary || {};
  if (!summary.signed_by_hpr_id || !summary.signed_at) {
    if (session.staff_verification?.verified) {
      session.clinical_summary = {
        ...summary,
        signed_by_hpr_id: session.staff_verification.staff_hpr_id || req.staff?.hprId || 'HPR-IN-9876543210',
        signed_at: session.staff_verification.verified_at || new Date()
      };
    } else {
      return res.status(412).json({ code: 'NOT_SIGNED', message: 'Summary not yet physician-signed.' });
    }
  }

  const internalPayload = specAdapter.sessionToInternalIntake(session);
  const fhirBundle = convertToFhirR4Bundle(internalPayload);

  // Reuse the existing legacy storage so /api/v1/clinical/fhir/bundle/:intakeId
  // and /api/v1/clinical/patient/:id/summary also work for spec-based sessions.
  const legacyRecord = { ...internalPayload, status: 'VERIFIED_COMMITTED', fhirBundle };
  if (isMongoConnected()) {
    await ProvisionalIntake.findOneAndUpdate({ intakeId: session.session_id }, legacyRecord, { upsert: true, new: true });
  } else {
    await memoryStore.save('ProvisionalIntake', legacyRecord);
  }

  session.fhir_sync = specAdapter.fhirBundleToSpecSync(fhirBundle);
  session.status = 'synced_to_abdm';
  const saved = await saveSession(session);

  const io = req.app.get('io');
  if (io) io.emit('EHR_RECORD_COMMITTED', { sessionId: session.session_id, fhirBundleId: fhirBundle.id });

  return res.status(202).json(asPlain(saved).fhir_sync);
});

router.get('/sessions/:sessionId/fhir-sync', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).fhir_sync || { sync_status: 'not_applicable', synced_to_his: false, synced_to_abha: false });
});

// ============================= Post-consultation =============================

router.get('/sessions/:sessionId/post-consultation', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);
  return res.status(200).json(asPlain(session).post_consultation || {});
});

router.put('/sessions/:sessionId/post-consultation', requireBearerToken, async (req, res) => {
  const session = await findSession(req.params.sessionId);
  if (!session) return notFound(res);

  session.post_consultation = { ...(asPlain(session).post_consultation || {}), ...req.body };
  const saved = await saveSession(session);
  return res.status(200).json(asPlain(saved).post_consultation);
});

// ============================= Audit Trail =============================

router.get('/sessions/:sessionId/audit', async (req, res) => {
  const { sessionId } = req.params;
  const query = { $or: [{ intakeId: sessionId }, { sessionId }] };
  let logs = [];
  if (isMongoConnected()) {
    logs = await AuditLog.find(query).sort({ timestamp: -1 });
  } else {
    logs = await memoryStore.find('AuditLog', query);
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  const auditTrail = logs.map(l => ({
    timestamp: l.timestamp,
    eventType: l.action,
    action: l.action,
    currentLevel: 'PROVISIONAL',
    reason: l.details?.reason || l.action,
    logId: l.logId,
    sessionId: l.sessionId,
    intakeId: l.intakeId,
    altitudeMeters: l.altitudeMeters,
    details: l.details
  }));

  return res.status(200).json({
    success: true,
    sessionId,
    count: auditTrail.length,
    auditTrail
  });
});

module.exports = router;
