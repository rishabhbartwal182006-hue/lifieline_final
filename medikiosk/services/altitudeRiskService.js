/**
 * services/altitudeRiskService.js
 * 
 * Altitude Risk & Clinical Context Engine
 * Formulated in accordance with CDC Yellow Book (High-Altitude Travel & Illness)
 * and the 2024 Wilderness Medical Society (WMS) Clinical Practice Guidelines.
 *
 * Fundamental Invariant:
 * Altitude provides clinical context. Symptoms and measured vitals provide severity.
 * Altitude NEVER alters, mutates, or normalizes raw vital readings, and NEVER downgrades
 * clinical triage severity.
 */

const DANGER_SYMPTOMS = [
  'chest pain',
  'chest discomfort',
  'chest pressure',
  'chest tightness',
  'breathlessness at rest',
  'shortness of breath at rest',
  'dyspnea at rest',
  'confusion',
  'altered mental status',
  'cyanosis',
  'blue lips',
  'inability to walk',
  'ataxia',
  'loss of balance',
  'unsteadiness',
  'fainting',
  'syncope',
  'loss of consciousness'
];

const AMS_SYMPTOMS = [
  'headache',
  'nausea',
  'vomiting',
  'fatigue',
  'weakness',
  'dizziness',
  'lightheadedness',
  'loss of appetite',
  'anorexia',
  'insomnia'
];

const DISCLAIMER = 'Clinical decision-support context engine. Raw sensor values are strictly preserved. Hypoxic exposure evaluated according to CDC and WMS clinical guidelines. Clinician assessment required.';

/**
 * Normalizes text from symptoms, complaints, and HPI into searchable text.
 */
function extractCorpus(sessionOrPatient) {
  const parts = [];
  if (!sessionOrPatient) return '';

  if (typeof sessionOrPatient.chiefComplaint === 'string') parts.push(sessionOrPatient.chiefComplaint);
  if (Array.isArray(sessionOrPatient.chiefComplaints)) {
    sessionOrPatient.chiefComplaints.forEach(c => {
      if (typeof c === 'string') parts.push(c);
      else if (c && typeof c.symptom === 'string') parts.push(c.symptom);
    });
  }
  if (Array.isArray(sessionOrPatient.symptoms)) {
    sessionOrPatient.symptoms.forEach(s => {
      if (typeof s === 'string') parts.push(s);
      else if (s && typeof s.name === 'string') parts.push(s.name);
      else if (s && typeof s.symptom === 'string') parts.push(s.symptom);
    });
  } else if (typeof sessionOrPatient.symptoms === 'string') {
    parts.push(sessionOrPatient.symptoms);
  }

  if (sessionOrPatient.hpi?.narrative) parts.push(sessionOrPatient.hpi.narrative);
  if (Array.isArray(sessionOrPatient.hpi?.associatedSymptoms)) {
    sessionOrPatient.hpi.associatedSymptoms.forEach(a => parts.push(String(a)));
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Checks if patient reports danger symptoms
 */
function hasDangerSymptoms(textOrList) {
  if (!textOrList) return false;
  const str = typeof textOrList === 'string' ? textOrList.toLowerCase() : JSON.stringify(textOrList).toLowerCase();
  return DANGER_SYMPTOMS.some(d => str.includes(d));
}

/**
 * Extracts raw vital numbers without altering them
 */
function extractRawVitals(sessionOrPatient) {
  const v = sessionOrPatient?.vitals || {};
  let spo2 = undefined;
  let systolic = undefined;
  let diastolic = undefined;
  let heartRate = undefined;

  if (typeof v.spo2 === 'number') spo2 = v.spo2;
  else if (v.spo2 && typeof v.spo2.value !== 'undefined') spo2 = Number(v.spo2.value);
  else if (typeof v.spo2 === 'string' && v.spo2.trim() !== '') spo2 = Number(v.spo2);

  if (v.bloodPressure?.systolic?.value !== undefined) systolic = Number(v.bloodPressure.systolic.value);
  else if (v.systolic !== undefined) systolic = Number(v.systolic);
  else if (typeof v.bp === 'string') {
    const m = v.bp.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) { systolic = Number(m[1]); diastolic = Number(m[2]); }
  }

  if (v.bloodPressure?.diastolic?.value !== undefined) diastolic = Number(v.bloodPressure.diastolic.value);
  else if (v.diastolic !== undefined) diastolic = Number(v.diastolic);

  if (v.heartRate?.value !== undefined) heartRate = Number(v.heartRate.value);
  else if (v.heartRate !== undefined) heartRate = Number(v.heartRate);

  return {
    spo2: !isNaN(spo2) ? spo2 : undefined,
    systolic: !isNaN(systolic) ? systolic : undefined,
    diastolic: !isNaN(diastolic) ? diastolic : undefined,
    heartRate: !isNaN(heartRate) ? heartRate : undefined
  };
}

/**
 * Evaluates objective altitude exposure and identifies altitude-illness context.
 * 
 * @param {object} sessionOrPatient 
 * @returns {object} AltitudeContextResult
 */
function evaluateAltitudeExposure(sessionOrPatient = {}) {
  // 1. Establish facility altitude (nullable)
  const envAlt = sessionOrPatient.environment?.altitudeMeters ??
                 sessionOrPatient.altitudeContext?.facilityAltitudeM ??
                 process.env.FACILITY_ALTITUDE_METERS;

  const facilityAltitudeM = (envAlt !== undefined && envAlt !== null && envAlt !== '' && !isNaN(Number(envAlt)))
    ? Number(envAlt)
    : null;

  // If facility altitude is not configured
  if (facilityAltitudeM === null) {
    return {
      altitudeContext: 'UNAVAILABLE',
      reasons: ['Facility elevation is not configured.'],
      patternsDetected: [],
      clinicalAdvisory: 'Altitude context unavailable (facility elevation unconfigured). Standard clinical protocols apply.',
      exposure: { facilityAltitudeM: null }
    };
  }

  // Threshold for acute altitude illness consideration: roughly >= 2,450 m (per WMS and CDC)
  if (facilityAltitudeM < 2450) {
    return {
      altitudeContext: 'NONE',
      reasons: [`Facility elevation (${facilityAltitudeM} m) is below acute altitude threshold (2,450 m).`],
      patternsDetected: [],
      clinicalAdvisory: 'Facility is below acute altitude illness threshold. Standard clinical guidelines apply.',
      exposure: { facilityAltitudeM }
    };
  }

  // 2. Extract objective patient exposure
  const exp = sessionOrPatient.altitudeContext?.exposure || {};
  const env = sessionOrPatient.environment || {};

  const isLongTermResident = exp.isLongTermResident === true ||
                             env.acclimatizationStatus === 'resident' ||
                             env.altitudeSource === 'resident';

  const usualSleepingAltitudeM = typeof exp.usualSleepingAltitudeM === 'number'
    ? exp.usualSleepingAltitudeM
    : typeof env.residenceAltitudeMeters === 'number'
    ? env.residenceAltitudeMeters
    : isLongTermResident ? facilityAltitudeM : 200; // default 200m if unacclimatized traveler

  const currentSleepingAltitudeM = typeof exp.currentSleepingAltitudeM === 'number'
    ? exp.currentSleepingAltitudeM
    : facilityAltitudeM;

  const hoursAtCurrentAltitude = typeof exp.hoursAtCurrentAltitude === 'number'
    ? exp.hoursAtCurrentAltitude
    : typeof env.timeAtAltitudeHours === 'number'
    ? env.timeAtAltitudeHours
    : undefined;

  const highestSleepingAltitudeLast14DaysM = typeof exp.highestSleepingAltitudeLast14DaysM === 'number'
    ? exp.highestSleepingAltitudeLast14DaysM
    : usualSleepingAltitudeM;

  // 3. Derived Exposure Metrics
  const ascentDeltaM = currentSleepingAltitudeM - usualSleepingAltitudeM;
  const acuteExposure = !isLongTermResident && (hoursAtCurrentAltitude === undefined || hoursAtCurrentAltitude <= 120); // 3-5 day window
  const rapidAscent = ascentDeltaM >= 1000 && (hoursAtCurrentAltitude === undefined || hoursAtCurrentAltitude <= 48);

  const reasons = [];
  reasons.push(`Facility elevation: ${facilityAltitudeM} m (High-Altitude Zone ≥ 2,450 m)`);

  if (isLongTermResident) {
    reasons.push(`Patient is a long-term resident (usual sleeping altitude: ${usualSleepingAltitudeM} m)`);
  } else {
    reasons.push(`Ascent delta: ${ascentDeltaM > 0 ? '+' : ''}${ascentDeltaM} m from usual sleeping elevation (${usualSleepingAltitudeM} m)`);
    if (hoursAtCurrentAltitude !== undefined) {
      reasons.push(`Duration at current altitude: ${hoursAtCurrentAltitude} hours (${acuteExposure ? 'within acute 3-5 day acclimatization window' : 'extended exposure'})`);
    } else {
      reasons.push('Recent arrival within acute acclimatization window');
    }
    if (rapidAscent) {
      reasons.push('Rapid ascent profile: elevation gain ≥ 1,000 m within acute timeframe');
    }
  }

  // 4. Clinical Syndrome Pattern Recognition
  const textCorpus = extractCorpus(sessionOrPatient);
  const rawVitals = extractRawVitals(sessionOrPatient);
  const patternsDetected = [];

  const hasHeadache = /(headache|head\s*pain|सिरदर्द|सिर\s*दर्द)/i.test(textCorpus);
  const hasAmsAssociated = /(nausea|vomit|fatigue|weakness|dizz|lightheaded|loss\s*of\s*appetite|anorexia|उल्टी|चक्कर)/i.test(textCorpus);
  const hasDyspnea = /(breath|shortness\s*of\s*breath|dyspnea|gasp|suffocat|सांस)/i.test(textCorpus);
  const hasNeurologicDeficit = /(confusion|altered\s*mental|ataxia|unsteady|loss\s*of\s*balance|inability\s*to\s*walk|slurred|बेहोश)/i.test(textCorpus);

  // Pattern A: AMS Context (Recent ascent + headache + >= 1 compatible symptom)
  if (acuteExposure && hasHeadache && hasAmsAssociated) {
    patternsDetected.push('AMS_CONTEXT');
    reasons.push('Clinical presentation (headache + associated symptoms after recent ascent) matches Acute Mountain Sickness (AMS) pattern.');
  }

  // Pattern B: HAPE Consideration (Recent ascent + respiratory distress / low SpO2)
  const isHypoxemic = typeof rawVitals.spo2 === 'number' && rawVitals.spo2 < 90;
  if ((acuteExposure || rapidAscent) && (hasDyspnea || isHypoxemic)) {
    patternsDetected.push('HAPE_CONSIDERATION');
    reasons.push('Respiratory symptoms and/or marked hypoxemia in an unacclimatized patient: High-Altitude Pulmonary Edema (HAPE) consideration warranted.');
  }

  // Pattern C: HACE Consideration (Recent ascent + encephalopathy / ataxia)
  if ((acuteExposure || rapidAscent) && hasNeurologicDeficit) {
    patternsDetected.push('HACE_CONSIDERATION');
    reasons.push('Neurological compromise / ataxia in high-altitude context: Emergent High-Altitude Cerebral Edema (HACE) consideration warranted.');
  }

  let altitudeContext = 'NONE';
  if (patternsDetected.length > 0 || rapidAscent || (acuteExposure && ascentDeltaM >= 1000)) {
    altitudeContext = 'SIGNIFICANT';
  } else if (acuteExposure) {
    altitudeContext = 'POSSIBLE';
  }

  let clinicalAdvisory = 'Patient is in high-altitude environment. ';
  if (patternsDetected.includes('HACE_CONSIDERATION')) {
    clinicalAdvisory += 'CRITICAL: Severe neurological findings after ascent. Emergency evacuation and descent protocol evaluation required.';
  } else if (patternsDetected.includes('HAPE_CONSIDERATION')) {
    clinicalAdvisory += 'URGENT: Respiratory symptoms with hypoxemia in high-altitude context. Evaluate urgently for HAPE alongside other acute respiratory decompensations.';
  } else if (patternsDetected.includes('AMS_CONTEXT')) {
    clinicalAdvisory += 'AMS clinical profile present. Symptomatic evaluation and rest advised; monitor for progression to HAPE/HACE.';
  } else if (isLongTermResident) {
    clinicalAdvisory += 'Patient is long-term resident. Objective severe vitals or danger symptoms must NOT be attributed to altitude.';
  } else {
    clinicalAdvisory += 'Patient recently arrived from lower elevation. Monitor for emergence of acute altitude-related illness.';
  }

  return {
    altitudeContext,
    reasons,
    patternsDetected,
    clinicalAdvisory,
    exposure: {
      facilityAltitudeM,
      currentSleepingAltitudeM,
      usualSleepingAltitudeM,
      arrivalAtCurrentSleepingAltitude: exp.arrivalAtCurrentSleepingAltitude,
      highestSleepingAltitudeLast14DaysM,
      derived: {
        ascentDeltaM,
        hoursAtCurrentAltitude,
        acuteExposure,
        rapidAscent,
        isLongTermResident
      }
    }
  };
}

/**
 * Backward-compatible helper for legacy routes.
 * Preserves raw vitals and attaches altitude context.
 */
function interpretVitals(vitalsInput, environmentInput, complaintsInput) {
  const sessionShim = {
    vitals: vitalsInput,
    environment: environmentInput,
    chiefComplaints: complaintsInput
  };

  const exposureResult = evaluateAltitudeExposure(sessionShim);
  const raw = extractRawVitals(sessionShim);
  const results = [];

  if (typeof raw.spo2 === 'number') {
    results.push({
      type: 'spo2',
      value: raw.spo2,
      unit: '%',
      altitudeMeters: exposureResult.exposure.facilityAltitudeM,
      status: raw.spo2 < 85 ? 'critical' : raw.spo2 < 90 ? 'urgent' : 'stable',
      adjustedForAltitude: false,
      algorithmVersion: 'wms-cdc-exposure-v2',
      altitudeContext: {
        facilityAltitudeM: exposureResult.exposure.facilityAltitudeM,
        context: exposureResult.altitudeContext,
        patterns: exposureResult.patternsDetected,
        advisory: exposureResult.clinicalAdvisory
      }
    });
  }

  if (typeof raw.systolic === 'number') {
    results.push({
      type: 'bp_systolic',
      value: raw.systolic,
      unit: 'mmHg',
      altitudeMeters: exposureResult.exposure.facilityAltitudeM,
      status: raw.systolic >= 180 ? 'critical' : raw.systolic < 90 ? 'critical' : 'normal',
      adjustedForAltitude: false,
      algorithmVersion: 'wms-cdc-exposure-v2'
    });
  }

  if (typeof raw.heartRate === 'number') {
    results.push({
      type: 'heart_rate',
      value: raw.heartRate,
      unit: 'bpm',
      altitudeMeters: exposureResult.exposure.facilityAltitudeM,
      status: raw.heartRate > 130 || raw.heartRate < 40 ? 'critical' : 'normal',
      adjustedForAltitude: false,
      algorithmVersion: 'wms-cdc-exposure-v2'
    });
  }

  return results;
}

module.exports = {
  DISCLAIMER,
  hasDangerSymptoms,
  evaluateAltitudeExposure,
  interpretVitals,
  extractRawVitals
};
