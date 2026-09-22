/**
 * specAdapter.js
 *
 * Bridges the openapi-spec-shaped Session model (snake_case, session-lifecycle
 * REST resource) with the ORIGINAL camelCase, one-shot ProvisionalIntake
 * pipeline (discrepancyEngine.js, fhirMapper.js) — so both API contracts can
 * share the same clinical logic instead of duplicating it.
 *
 * Nothing in discrepancyEngine.js or fhirMapper.js is modified. This module
 * only translates shapes in both directions.
 */

const GENDER_MAP = { male: 'M', female: 'F', other: 'O', M: 'M', F: 'F', O: 'O' };
const VITAL_SEVERITY_MAP = { Mild: 'Mild', Moderate: 'Moderate', Severe: 'Severe' };

function severityFromSourcedValue(sv) {
  if (!sv || !sv.value) return undefined;
  const v = String(sv.value).toLowerCase();
  if (v.includes('sever') || v.startsWith('8') || v.startsWith('9') || v.startsWith('10')) return 'Severe';
  if (v.includes('moderate') || /^[4-7]/.test(v)) return 'Moderate';
  return 'Mild';
}

function documentTypeToInternal(specType) {
  const map = {
    prescription: 'Prescription',
    lab_report: 'LabReport',
    discharge_summary: 'DischargeSummary',
    imaging_report: 'Other',
    other: 'Other'
  };
  return map[specType] || 'Other';
}

function documentTypeToSpec(internalType) {
  const map = {
    Prescription: 'prescription',
    LabReport: 'lab_report',
    DischargeSummary: 'discharge_summary',
    Other: 'other'
  };
  return map[internalType] || 'other';
}

/** Build the { bloodPressure, spo2, heartRate, temperature, bloodGlucose } shape
 * discrepancyEngine.js / fhirMapper.js expect, from the spec's flat vitals array. */
function buildInternalVitals(vitalsArray = []) {
  const wrap = (reading) => reading && {
    value: reading.value,
    unit: reading.unit,
    provenanceMeta: {
      provenance: reading.source === 'device' ? 'device-captured'
        : reading.source === 'patient_reported' ? 'patient-spoken'
        : 'touch-selected',
      confidence: reading.confidence ?? 1.0,
      timestamp: reading.captured_at
    },
    ...(reading.altitudeContext ? { altitudeContext: reading.altitudeContext } : {})
  };

  const latest = (type) => [...vitalsArray].reverse().find(v => v.type === type || v.vital_type === type);

  let systolic = latest('bp_systolic');
  let diastolic = latest('bp_diastolic');
  const bpComposite = latest('blood_pressure') || latest('bp');

  if ((!systolic || !diastolic) && bpComposite) {
    const rawVal = bpComposite.value;
    if (typeof rawVal === 'string' && rawVal.includes('/')) {
      const [sysPart, diaPart] = rawVal.split('/');
      if (!systolic) {
        systolic = { ...bpComposite, value: Number(sysPart.replace(/[^\d.]/g, '')), unit: 'mmHg' };
      }
      if (!diastolic) {
        diastolic = { ...bpComposite, value: Number(diaPart.replace(/[^\d.]/g, '')), unit: 'mmHg' };
      }
    } else if (typeof rawVal === 'object' && rawVal !== null) {
      if (!systolic && rawVal.systolic != null) {
        systolic = { ...bpComposite, value: Number(rawVal.systolic), unit: 'mmHg' };
      }
      if (!diastolic && rawVal.diastolic != null) {
        diastolic = { ...bpComposite, value: Number(rawVal.diastolic), unit: 'mmHg' };
      }
    }
  }

  const bpVal = (systolic && diastolic) ? `${systolic.value}/${diastolic.value}` : undefined;
  const hrReading = latest('heart_rate') || latest('pulse');
  const gluReading = latest('blood_glucose') || latest('glucose');

  return {
    bloodPressure: (systolic || diastolic) ? {
      systolic: wrap(systolic),
      diastolic: wrap(diastolic)
    } : undefined,
    bp: bpVal,
    systolic: systolic ? systolic.value : undefined,
    diastolic: diastolic ? diastolic.value : undefined,
    spo2: wrap(latest('spo2')),
    heartRate: wrap(hrReading),
    hr: hrReading ? hrReading.value : undefined,
    temperature: wrap(latest('temperature')),
    temp: latest('temperature') ? latest('temperature').value : undefined,
    bloodGlucose: wrap(gluReading),
    glucose: gluReading ? gluReading.value : undefined,
    bloodSugar: gluReading ? `${gluReading.value} mg/dL` : undefined
  };
}

function buildHpiNarrative(hpi = {}) {
  const parts = [hpi.site?.value, hpi.character?.value, hpi.onset?.value, hpi.radiation?.value && `radiating to ${hpi.radiation.value}`]
    .filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

/**
 * Convert a spec-shaped Session (mongoose doc or plain object) into the
 * camelCase "intakePayload" shape that discrepancyEngine.evaluateClinicalDiscrepancies
 * and fhirMapper.convertToFhirR4Bundle already know how to consume.
 */
function sessionToInternalIntake(session) {
  const s = session.toObject ? session.toObject() : session;
  const intake = s.intake || {};
  const hpi = intake.hpi || {};

  return {
    intakeId: s.session_id,
    abhaId: s.patient?.abha_id || s.session_id,
    status: 'PROVISIONAL',
    patientDemographics: {
      fullName: s.patient?.name || 'Anonymous Patient',
      gender: GENDER_MAP[s.patient?.gender] || 'O',
      age: s.patient?.age || 0,
      phone: s.patient?.phone,
      provenanceMeta: { provenance: 'touch-selected', confidence: 1.0, timestamp: s.created_at }
    },
    environment: s.environment,
    vitals: buildInternalVitals(s.vitals),
    chiefComplaints: intake.chief_complaint ? [{
      symptom: intake.chief_complaint.value,
      duration: hpi.onset?.value,
      severity: severityFromSourcedValue(hpi.severity),
      provenanceMeta: {
        provenance: intake.chief_complaint.source,
        confidence: intake.chief_complaint.confidence,
        timestamp: intake.chief_complaint.captured_at
      }
    }] : [],
    hpi: {
      narrative: buildHpiNarrative(hpi),
      onset: hpi.onset?.value,
      associatedSymptoms: (hpi.associated_symptoms || []).map(v => v.value)
    },
    history: {
      pastDiagnoses: (intake.past_history || []).map(v => ({ condition: v.value })),
      allergies: (intake.drug_allergy_history || [])
        .filter(v => v.value && !/no known/i.test(v.value))
        .map(v => ({ allergen: v.value })),
      currentMedications: [],
      familyHistory: (intake.family_history || []).map(v => ({ condition: v.value }))
    },
    ayushParameters: intake.ayush_module ? {
      agni: intake.ayush_module.agni?.value,
      koshtha: intake.ayush_module.koshtha?.value,
      mutra: undefined,
      nadi: undefined
    } : undefined,
    ocrDocuments: (s.documents || []).map(d => ({
      documentId: d.document_id,
      documentType: documentTypeToInternal(d.document_type),
      extractedDate: d.document_date,
      extractedMedications: (d.extracted_fields || [])
        .filter(f => f.field === 'medicine_name')
        .map(f => ({ name: f.value })),
      extractedLabs: (d.extracted_fields || [])
        .filter(f => f.field !== 'medicine_name' && f.field !== 'diagnosis')
        .map(f => ({ testName: f.field, resultValue: f.value })),
      fileUrl: d.raw_image_ref,
      provenanceMeta: { provenance: 'scanned-document', confidence: 0.9, timestamp: d.uploaded_at }
    })),
    triage: s.red_flags?.length ? {
      triageLevel: s.red_flags.some(f => f.urgency_tier === 'critical') ? 'EMERGENCY'
        : s.red_flags.some(f => f.urgency_tier === 'urgent') ? 'PRIORITY' : 'ROUTINE'
    } : undefined
  };
}

/** Map discrepancyEngine.js's internal flag objects into spec Discrepancy objects. */
function internalDiscrepanciesToSpec(internalFlags = []) {
  return internalFlags.map(f => ({
    discrepancy_id: f.flagId,
    description: f.message,
    source_a_ref: f.field,
    source_b_ref: null,
    detected_at: new Date(),
    status: 'unresolved'
  }));
}

/** Map fhirMapper.js's returned bundle into the spec's FhirSync object. */
function fhirBundleToSpecSync(fhirBundle) {
  return {
    fhir_bundle_id: fhirBundle?.id || null,
    synced_to_his: true,
    synced_to_abha: true,
    synced_at: new Date(),
    sync_status: 'success'
  };
}

module.exports = {
  sessionToInternalIntake,
  internalDiscrepanciesToSpec,
  fhirBundleToSpecSync,
  documentTypeToInternal,
  documentTypeToSpec
};
