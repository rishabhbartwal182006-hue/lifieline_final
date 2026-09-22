/**
 * redFlagRules.js
 *
 * Multi-System Clinical Red-Flag & Triage Rules including:
 * - Cardiovascular (Heart Attack / ACS, Cardiogenic Shock, Cardiac Arrest)
 * - Neurological (Stroke FAST criteria, Thunderclap Headache, Seizures, Unconsciousness)
 * - Respiratory (Critical Hypoxemia, Airway Obstruction / Stridor, Severe Dyspnea)
 * - Metabolic / Glycemic (DKA / HHS Hyperglycemic Crisis vs. Isolated Severe Hyperglycemia vs. Severe Hypoglycemia)
 * - Trauma, Bleeding & Anaphylaxis (Profuse Hemorrhage, Angioedema, Head Trauma)
 * - Sepsis & Circulatory Shock (Hypotension < 90, Septic Shock Triad)
 * - Hypertensive Crisis (BP >= 180/120)
 * - High-Altitude Physiology (Altitude-Adjusted Hypoxemia, Acute Mountain Sickness)
 *
 * Decision-support rules designed for clinical safety and triage prioritization.
 */

const { evaluateAltitudeExposure, hasDangerSymptoms } = require('./altitudeRiskService');

/**
 * Extracts a specific vital reading from session vitals array or object.
 */
function latestVital(vitals, type) {
  if (!vitals) return undefined;

  // 1. Array of { type, value } objects (session.vitals style)
  if (Array.isArray(vitals)) {
    return [...vitals].reverse().find(v => v.type === type || v.vital_type === type);
  }

  // 2. Plain object with type properties
  if (typeof vitals === 'object') {
    if (vitals[type] !== undefined) {
      const v = vitals[type];
      return typeof v === 'object' && v !== null && v.value !== undefined ? v : { value: v };
    }
  }
  return undefined;
}

/**
 * Helper to ensure empty strings or non-numbers are undefined.
 */
function toValidNumber(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '') return undefined;
    const num = Number(trimmed);
    return !isNaN(num) ? num : undefined;
  }
  const num = Number(val);
  return !isNaN(num) ? num : undefined;
}

/**
 * Normalizes vital signs from various payload shapes into clean numbers.
 */
function normalizePatientVitals(rawVitals) {
  if (!rawVitals) return {};

  let systolic, diastolic, spo2, heartRate, bloodGlucose, temperature;

  if (Array.isArray(rawVitals)) {
    systolic = toValidNumber(latestVital(rawVitals, 'bp_systolic')?.value);
    diastolic = toValidNumber(latestVital(rawVitals, 'bp_diastolic')?.value);
    spo2 = toValidNumber(latestVital(rawVitals, 'spo2')?.value);
    heartRate = toValidNumber(latestVital(rawVitals, 'heart_rate')?.value || latestVital(rawVitals, 'pulse')?.value);
    bloodGlucose = toValidNumber(latestVital(rawVitals, 'blood_glucose')?.value || latestVital(rawVitals, 'glucose')?.value);
    temperature = toValidNumber(latestVital(rawVitals, 'temperature')?.value);
  } else if (typeof rawVitals === 'object') {
    // Nested kiosk format (payload.vitals.bloodPressure.systolic.value)
    if (rawVitals.bloodPressure?.systolic?.value !== undefined) {
      systolic = toValidNumber(rawVitals.bloodPressure.systolic.value);
      diastolic = toValidNumber(rawVitals.bloodPressure.diastolic?.value);
    }
    if (rawVitals.spo2?.value !== undefined) {
      spo2 = toValidNumber(rawVitals.spo2.value);
    }
    if (rawVitals.heartRate?.value !== undefined) {
      heartRate = toValidNumber(rawVitals.heartRate.value);
    }
    if (rawVitals.bloodGlucose?.value !== undefined) {
      bloodGlucose = toValidNumber(rawVitals.bloodGlucose.value);
    }
    if (rawVitals.temperature?.value !== undefined) {
      temperature = toValidNumber(rawVitals.temperature.value);
    }

    // Direct numbers or strings
    if (systolic === undefined && rawVitals.systolic !== undefined) systolic = toValidNumber(rawVitals.systolic);
    if (diastolic === undefined && rawVitals.diastolic !== undefined) diastolic = toValidNumber(rawVitals.diastolic);
    if (spo2 === undefined && rawVitals.spo2 !== undefined) spo2 = toValidNumber(rawVitals.spo2);
    if (heartRate === undefined && (rawVitals.heartRate !== undefined || rawVitals.heart_rate !== undefined || rawVitals.pulse !== undefined)) {
      heartRate = toValidNumber(rawVitals.heartRate ?? rawVitals.heart_rate ?? rawVitals.pulse);
    }
    if (bloodGlucose === undefined && (rawVitals.bloodGlucose !== undefined || rawVitals.bloodSugar !== undefined || rawVitals.glucose !== undefined)) {
      const gRaw = rawVitals.bloodGlucose ?? rawVitals.bloodSugar ?? rawVitals.glucose;
      if (typeof gRaw === 'string') {
        const cleaned = gRaw.replace(/[^\d.]/g, '');
        bloodGlucose = cleaned !== '' ? parseFloat(cleaned) : undefined;
      } else {
        bloodGlucose = toValidNumber(gRaw);
      }
    }
    if (temperature === undefined && rawVitals.temperature !== undefined) {
      temperature = toValidNumber(rawVitals.temperature);
    }

    // BP string format like "120/80" or "185 / 105"
    if ((systolic === undefined || isNaN(systolic)) && typeof rawVitals.bp === 'string') {
      const match = rawVitals.bp.match(/(\d+)\s*[/]\s*(\d+)/);
      if (match) {
        systolic = toValidNumber(match[1]);
        diastolic = toValidNumber(match[2]);
      }
    }
  }

  return {
    systolic: systolic !== undefined && !isNaN(systolic) ? systolic : undefined,
    diastolic: diastolic !== undefined && !isNaN(diastolic) ? diastolic : undefined,
    spo2: spo2 !== undefined && !isNaN(spo2) ? spo2 : undefined,
    heartRate: heartRate !== undefined && !isNaN(heartRate) ? heartRate : undefined,
    bloodGlucose: bloodGlucose !== undefined && !isNaN(bloodGlucose) ? bloodGlucose : undefined,
    temperature: temperature !== undefined && !isNaN(temperature) ? temperature : undefined
  };
}

/**
 * Normalizes text from symptoms, chief complaint, and HPI narrative into searchable text.
 */
function extractAllTextCorpus(sessionOrPatient) {
  const parts = [];

  // Chief complaint
  if (typeof sessionOrPatient.intake?.chief_complaint?.value === 'string') {
    parts.push(sessionOrPatient.intake.chief_complaint.value);
  }
  if (typeof sessionOrPatient.chiefComplaint === 'string') {
    parts.push(sessionOrPatient.chiefComplaint);
  }
  if (Array.isArray(sessionOrPatient.chiefComplaints)) {
    sessionOrPatient.chiefComplaints.forEach(c => {
      if (typeof c === 'string') parts.push(c);
      else if (c && typeof c.symptom === 'string') parts.push(c.symptom);
    });
  }

  // Symptoms array
  if (Array.isArray(sessionOrPatient.symptoms)) {
    sessionOrPatient.symptoms.forEach(s => {
      if (typeof s === 'string') parts.push(s);
      else if (s && typeof s.name === 'string') parts.push(s.name);
      else if (s && typeof s.symptom === 'string') parts.push(s.symptom);
    });
  } else if (typeof sessionOrPatient.symptoms === 'string') {
    parts.push(sessionOrPatient.symptoms);
  }

  // HPI object or narrative
  if (typeof sessionOrPatient.hpi === 'string') {
    parts.push(sessionOrPatient.hpi);
  } else if (sessionOrPatient.hpi && typeof sessionOrPatient.hpi === 'object') {
    Object.values(sessionOrPatient.hpi).forEach(v => {
      if (typeof v === 'string') parts.push(v);
    });
  }
  if (typeof sessionOrPatient.intake?.hpi?.narrative === 'string') {
    parts.push(sessionOrPatient.intake.hpi.narrative);
  }
  if (Array.isArray(sessionOrPatient.intake?.hpi?.associated_symptoms)) {
    sessionOrPatient.intake.hpi.associated_symptoms.forEach(v => {
      if (typeof v === 'string') parts.push(v);
      else if (v && typeof v.value === 'string') parts.push(v.value);
    });
  }

  return parts.join(' ').toLowerCase();
}

/**
 * Master multi-system red-flag detector.
 * Evaluates session or patient intake data and returns triggered red flags.
 */
function detectRedFlags(sessionOrPatient) {
  const flags = [];
  const now = new Date();
  const sessionId = sessionOrPatient.session_id || sessionOrPatient.sessionId || sessionOrPatient.patientId || `SESS-${Date.now()}`;

  const textCorpus = extractAllTextCorpus(sessionOrPatient);
  const vitals = normalizePatientVitals(sessionOrPatient.vitals);
  const envAlt = sessionOrPatient.environment?.altitudeMeters ??
                 sessionOrPatient.altitudeContext?.facilityAltitudeM ??
                 process.env.FACILITY_ALTITUDE_METERS;
  const facilityAlt = (envAlt !== undefined && envAlt !== null && envAlt !== '' && !isNaN(Number(envAlt)))
    ? Number(envAlt)
    : null;
  const isHighAltitude = facilityAlt !== null && facilityAlt >= 2450;


  // Helper to push a red flag
  const addFlag = (flagType, urgencyTier, reason, metadata = {}) => {
    flags.push({
      flag_id: `FLAG-${sessionId}-${flagType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      flag_type: flagType,
      urgency_tier: urgencyTier, // 'critical' or 'urgent'
      detected_at: now,
      status: 'active',
      reason,
      ...metadata
    });
  };

  // =========================================================================
  // 1. CARDIOVASCULAR RED FLAGS
  // =========================================================================
  const isDirectCardiacEvent = /(heart\s*attack|myocardial\s*infarction|cardiac\s*arrest|acute\s*coronary|coronary\s*syndrome|unstable\s*angina)/i.test(textCorpus);
  const hasChestPain = /(chest\s*(pain|discomfort|pressure|tightness|heaviness|ache|squeezing)|angina)/i.test(textCorpus);
  const hasRadiation = /(radiat|left\s*arm|arm\s*pain|jaw|neck|shoulder|between\s*shoulder|back\s*pain)/i.test(textCorpus);
  const hasDiaphoresis = /(sweat|diaphor|cold\s*sweat|perspir)/i.test(textCorpus);
  const hasDyspnea = /(breath|shortness\s*of\s*breath|dyspnea|gasp|suffocat|सांस)/i.test(textCorpus);

  if (isDirectCardiacEvent) {
    addFlag(
      'acute_cardiac_event',
      'critical',
      'Acute Cardiac Event Presentation: Patient reports acute myocardial infarction / heart attack symptoms. Immediate ECG and resuscitation alert required.'
    );
  } else if (hasChestPain && (hasRadiation || hasDiaphoresis || hasDyspnea)) {
    addFlag(
      'chest_pain_high_risk_cardiac',
      'critical',
      'Acute Coronary Syndrome (ACS) Red Flag: Chest pain/pressure presenting with radiation to arm/jaw, diaphoresis, or acute dyspnea.'
    );
  } else if (hasChestPain && typeof vitals.systolic === 'number' && vitals.systolic < 90) {
    addFlag(
      'cardiogenic_shock_risk',
      'critical',
      `Cardiogenic Shock Alert: Acute chest discomfort presenting concurrently with critical hypotension (Systolic BP ${vitals.systolic} mmHg < 90 mmHg).`
    );
  } else if (hasChestPain && typeof vitals.heartRate === 'number' && vitals.heartRate > 130) {
    addFlag(
      'chest_pain_severe_tachycardia',
      'critical',
      `Unstable Cardiac Presentation: Acute chest discomfort presenting with marked tachycardia (${vitals.heartRate} bpm).`
    );
  } else if (hasChestPain) {
    addFlag(
      'unspecified_chest_pain',
      'urgent',
      'Acute Chest Discomfort: Patient reports chest pain/discomfort requiring priority clinical review and baseline 12-lead ECG.'
    );
  }

  // =========================================================================
  // 2. NEUROLOGICAL RED FLAGS
  // =========================================================================
  const hasStrokeFAST = /(facial\s*droop|face\s*droop|arm\s*weakness|leg\s*weakness|slurred\s*speech|difficulty\s*speaking|loss\s*of\s*speech|aphasia|hemipares|one\s*side.*weak|stroke|cva|tia|लकवा)/i.test(textCorpus);
  const hasThunderclapHeadache = /(thunderclap|worst\s*headache\s*of\s*(my\s*)?life|sudden\s*severe\s*headache|explosive\s*headache)/i.test(textCorpus);
  const hasSeizures = /(seizure|convulsion|epilep|fit|fits|दौरा)/i.test(textCorpus);
  const hasUnconsciousness = /(unconscious|loss\s*of\s*consciousness|faint|syncope|passed\s*out|blackout|collapsed|unresponsive|coma|बेहोश)/i.test(textCorpus);

  if (hasStrokeFAST) {
    addFlag(
      'acute_stroke_fast_alert',
      'critical',
      'Acute Stroke Alert (FAST Criteria): Patient exhibits acute focal neurological signs (facial droop, unilateral motor weakness, or acute speech deficit). Emergent neuroimaging time window active.'
    );
  }
  if (hasThunderclapHeadache) {
    addFlag(
      'thunderclap_headache_sah',
      'critical',
      'Thunderclap Headache Alert: Instantaneous, hyperacute severe headache suggests Subarachnoid Hemorrhage (SAH) or cerebral vascular crisis.'
    );
  }
  if (hasSeizures) {
    addFlag(
      'active_seizure_presentation',
      'critical',
      'Active / Acute Seizure Alert: Patient reports active convulsions, recurrent seizures, or post-ictal state.'
    );
  }
  if (hasUnconsciousness) {
    addFlag(
      'loss_of_consciousness',
      'critical',
      'Syncope / Loss of Consciousness Alert: Patient presents with acute collapse, unresponsiveness, or transient loss of consciousness.'
    );
  }

  // =========================================================================
  // 3. RESPIRATORY RED FLAGS
  // =========================================================================
  const hasAirwayCompromise = /(stridor|choking|airway\s*obstruction|gasping\s*for\s*air|inability\s*to\s*breathe|blue\s*lips|cyanosis)/i.test(textCorpus);
  const hasSevereAsthma = /(severe\s*asthma|acute\s*asthma\s*attack|severe\s*wheez)/i.test(textCorpus);
  const hasHemoptysis = /(cough(ing)?\s*blood|blood\s*in\s*cough|hemoptysis)/i.test(textCorpus);

  if (hasAirwayCompromise || hasSevereAsthma) {
    addFlag(
      'acute_airway_respiratory_failure',
      'critical',
      'Critical Airway / Acute Respiratory Distress: Patient presents with stridor, severe acute asthma, cyanosis, or impending airway compromise.'
    );
  }
  if (hasHemoptysis && (hasDyspnea || (vitals.spo2 && vitals.spo2 < 94))) {
    addFlag(
      'hemoptysis_with_hypoxia',
      'critical',
      'Hemoptysis with Respiratory Distress: Coughing blood accompanied by respiratory compromise / hypoxemia.'
    );
  } else if (hasHemoptysis) {
    addFlag(
      'isolated_hemoptysis',
      'urgent',
      'Hemoptysis Alert: Patient reports coughing blood; expedited pulmonary evaluation required.'
    );
  }

  // SpO2 Clinical Respiratory Evaluation (Raw Vitals Only)

  if (typeof vitals.spo2 === 'number') {
    if (vitals.spo2 < 85) {
      addFlag(
        'critical_severe_hypoxemia',
        'critical',
        `Critical Severe Hypoxemia: SpO2 is dangerously low (${vitals.spo2}% < 85%). High risk of impending respiratory failure; immediate oxygenation and resuscitation evaluation required.`
      );
    } else if (vitals.spo2 < 90) {
      addFlag(
        'critical_hypoxemia',
        'critical',
        `Critical Hypoxemia: SpO2 is dangerously low (${vitals.spo2}% < 90%). High risk of acute respiratory decompensation.`
      );
    } else if (vitals.spo2 < 94) {
      // At high altitude (>= 2450m), 90-93% without symptoms is typical baseline per WMS/CDC.
      // At standard elevation (< 2450m) or if respiratory symptoms exist, flag as moderate hypoxemia.
      if (!isHighAltitude || hasDyspnea) {
        addFlag(
          'moderate_hypoxemia',
          'urgent',
          `Moderate Hypoxemia: SpO2 (${vitals.spo2}%) is sub-optimal (90-93%). Expedited clinical evaluation and respiratory monitoring required.`
        );
      }
    }
  } else if (hasDyspnea) {
    addFlag(
      'respiratory_distress_unmeasured_vitals',
      'urgent',
      'Acute dyspnea / respiratory distress reported with unmeasured hardware vitals: Immediate bedside pulse oximetry required.'
    );
  }

  // =========================================================================
  // 4. METABOLIC & GLYCEMIC RED FLAGS (TIGHTENED CLINICAL RULES)
  // =========================================================================
  const hasDkaSymptoms = /(vomit|nausea|vomiting|kussmaul|rapid\s*deep\s*breath|fruity\s*breath|acetone|abdominal\s*pain|drowsy|confus|उल्टी)/i.test(textCorpus);

  if (typeof vitals.bloodGlucose === 'number') {
    const bg = vitals.bloodGlucose;

    // A. Severe Hypoglycemia (< 60 mg/dL) -> Critical EMERGENCY
    if (bg < 60) {
      addFlag(
        'severe_hypoglycemia',
        'critical',
        `Severe Hypoglycemia Alert: Blood glucose is critically low (${bg} mg/dL < 60 mg/dL). High risk of neuroglycopenia, seizure, or coma. Immediate fast-acting carbohydrate / IV dextrose required.`
      );
    }
    // B. Hyperglycemic Crisis (DKA / HHS): Blood glucose >= 250 mg/dL WITH DKA symptoms -> Critical EMERGENCY
    else if (bg >= 250 && hasDkaSymptoms) {
      addFlag(
        'hyperglycemic_crisis_dka',
        'critical',
        `Hyperglycemic Crisis (Suspected DKA / HHS): Marked hyperglycemia (${bg} mg/dL) presenting concurrently with systemic red flags (nausea/vomiting/abdominal pain/altered breathing). Immediate ketone check, IV hydration, and insulin protocol required.`
      );
    }
    // C. Isolated Severe Hyperglycemia (>= 300 mg/dL without acute DKA symptoms) -> URGENT
    else if (bg >= 300) {
      addFlag(
        'isolated_severe_hyperglycemia',
        'urgent',
        `Isolated Severe Hyperglycemia: Blood glucose is markedly elevated (${bg} mg/dL >= 300 mg/dL) without acute ketoacidosis symptoms. Priority clinician review, ketone screening, and medication adjustment required.`
      );
    }
    // D. Moderate Hyperglycemia (200-299 mg/dL) -> URGENT
    else if (bg >= 200) {
      addFlag(
        'moderate_hyperglycemia',
        'urgent',
        `Moderate Hyperglycemia: Blood glucose is elevated (${bg} mg/dL >= 200 mg/dL). Prioritized clinical evaluation recommended.`
      );
    }
  }

  // =========================================================================
  // 5. TRAUMA, BLEEDING & ANAPHYLAXIS
  // =========================================================================
  const hasProfuseBleeding = /(profuse\s*bleed|uncontrolled\s*bleed|arterial\s*bleed|severe\s*bleed|gushing\s*blood|खून\s*बह)/i.test(textCorpus);
  const hasSevereHeadTrauma = /(head\s*injury|head\s*trauma|skull\s*fracture|hit\s*on\s*head)/i.test(textCorpus);
  const hasAnaphylaxis = /(anaphylax|throat\s*swelling|tongue\s*swelling|lip\s*swelling|angioedema|severe\s*allergic)/i.test(textCorpus);

  if (hasProfuseBleeding) {
    addFlag(
      'uncontrolled_hemorrhage',
      'critical',
      'Uncontrolled Hemorrhage Alert: Active profuse bleeding reported. Immediate pressure dressing and surgical/trauma resuscitation required.'
    );
  }
  if (hasAnaphylaxis) {
    addFlag(
      'anaphylaxis_shock_risk',
      'critical',
      'Anaphylaxis Alert: Acute angioedema (lip/tongue/throat swelling) with airway compromise risk. Immediate intramuscular epinephrine preparation required.'
    );
  }
  if (hasSevereHeadTrauma && (hasUnconsciousness || hasThunderclapHeadache)) {
    addFlag(
      'severe_head_trauma',
      'critical',
      'Severe Head Trauma with Neurological Impairment: Head injury accompanied by altered consciousness or severe acute headache.'
    );
  }

  // =========================================================================
  // 6. SEPSIS, CIRCULATORY SHOCK & BLOOD PRESSURE RED FLAGS
  // =========================================================================
  const sys = vitals.systolic;
  const dia = vitals.diastolic;

  // Critical Hypotension (Shock)
  if (typeof sys === 'number' && sys < 90) {
    addFlag(
      'critical_hypotension',
      'critical',
      `Critical Hypotension / Circulatory Shock: Systolic blood pressure (${sys} mmHg < 90 mmHg) indicates hemodynamic collapse.`
    );
  }

  // Hypertensive Crisis
  if (typeof sys === 'number' && typeof dia === 'number') {
    if (sys >= 180 || dia >= 120) {
      addFlag(
        'hypertensive_crisis',
        'critical',
        `Hypertensive Crisis: BP ${sys}/${dia} mmHg (>= 180/120 mmHg) presents severe risk of acute aortic dissection, stroke, or encephalopathy.`
      );
    } else if (sys >= 160 || dia >= 100) {
      addFlag(
        'stage2_hypertension',
        'urgent',
        `Stage 2 Hypertension: BP ${sys}/${dia} mmHg requires prioritized clinical evaluation.`
      );
    }
  }

  // Sepsis / Septic Shock Screening
  const hasFever = /(high\s*fever|chills|rigors|बुखार)/i.test(textCorpus) || (typeof vitals.temperature === 'number' && vitals.temperature > 38.5);
  if (hasFever && typeof sys === 'number' && sys < 90 && typeof vitals.heartRate === 'number' && vitals.heartRate > 100) {
    addFlag(
      'septic_shock_triad',
      'critical',
      'Septic Shock Alert: High fever presenting concurrently with critical hypotension (Systolic BP < 90 mmHg) and tachycardia. qSOFA sepsis criteria met.'
    );
  }

  // Marked Arrhythmia / Heart Rate Outliers
  if (typeof vitals.heartRate === 'number') {
    if (vitals.heartRate > 150) {
      addFlag(
        'severe_tachycardia',
        'urgent',
        `Severe Tachycardia: Resting heart rate (${vitals.heartRate} bpm > 150 bpm) indicates acute hemodynamic distress.`
      );
    } else if (vitals.heartRate < 40) {
      addFlag(
        'severe_bradycardia',
        'urgent',
        `Severe Bradycardia: Resting heart rate (${vitals.heartRate} bpm < 40 bpm) carries high risk of syncope or conduction block.`
      );
    }
  }

  // =========================================================================
  // 7. ACUTE ABDOMEN RED FLAGS
  // =========================================================================
  const hasSevereAbdominalPain = /(severe\s*abdominal\s*pain|severe\s*stomach\s*pain|acute\s*abdomen|appendicitis|pancreatitis|peritonitis|intense\s*belly\s*pain|पेट.*दर्द)/i.test(textCorpus);
  const hasGiBleed = /(vomit(ing)?\s*blood|hematemesis|black\s*stool|coffee\s*ground|melena)/i.test(textCorpus);

  if (hasGiBleed) {
    addFlag(
      'acute_gi_hemorrhage',
      'urgent',
      'Acute Upper/Lower GI Hemorrhage Alert: Patient reports vomiting blood or melena; priority endoscopy evaluation required.'
    );
  } else if (hasSevereAbdominalPain) {
    addFlag(
      'acute_abdomen',
      'urgent',
      'Acute Abdomen: Severe acute abdominal pain reported; requires prompt physical examination and surgical evaluation.'
    );
  }

  // =========================================================================
  // 8. HIGH ALTITUDE (AMS / HAPE / HACE)
  // =========================================================================
  if (isHighAltitude) {
    const hasHeadache = textCorpus.includes('headache') || textCorpus.includes('सिर');
    const hasNausea = textCorpus.includes('nausea') || textCorpus.includes('vomit') || textCorpus.includes('उल्टी');
    const hasDizziness = textCorpus.includes('dizzy') || textCorpus.includes('giddiness') || textCorpus.includes('चक्कर');
    const hasSleepIssue = textCorpus.includes('sleep') || textCorpus.includes('insomnia');

    if (hasHeadache && (hasNausea || hasDizziness || hasSleepIssue)) {
      addFlag(
        'possible_acute_mountain_sickness',
        'urgent',
        `Acute Mountain Sickness (AMS) Clinical Pattern at ${facilityAlt}m: Headache with compatible symptoms after recent ascent.`
      );
    }
  }

  return flags;
}

/**
 * Structured 3-Tier Clinical Disease Taxonomy for Intelligent Triage Routing
 */
const CLINICAL_ILLNESS_TAXONOMY = {
  EMERGENCY: [
    { pattern: /(heart\s*attack|myocardial\s*infarction|cardiac\s*arrest|acute\s*coronary|coronary\s*syndrome|unstable\s*angina)/i, label: 'Acute Myocardial Infarction / ACS' },
    { pattern: /(stroke|cva|tia|facial\s*droop|arm\s*weakness|slurred\s*speech|aphasia|hemipares|paralysis|लकवा)/i, label: 'Acute Ischemic / Hemorrhagic Stroke' },
    { pattern: /(stridor|choking|airway\s*obstruction|gasping\s*for\s*air|inability\s*to\s*breathe|cyanosis|blue\s*lips)/i, label: 'Acute Airway Obstruction / Respiratory Failure' },
    { pattern: /(thunderclap|worst\s*headache\s*of\s*(my\s*)?life|explosive\s*headache)/i, label: 'Thunderclap Headache (Suspected SAH)' },
    { pattern: /(active\s*seizure|status\s*epilepticus|continuous\s*convulsion)/i, label: 'Active Convulsive Status / Seizure' },
    { pattern: /(unconscious|loss\s*of\s*consciousness|syncope|collapsed|unresponsive|coma|बेहोश)/i, label: 'Acute Syncope / Unresponsiveness' },
    { pattern: /(profuse\s*bleed|uncontrolled\s*bleed|arterial\s*bleed|gushing\s*blood)/i, label: 'Major Uncontrolled Hemorrhage' },
    { pattern: /(anaphylax|throat\s*swelling|tongue\s*swelling|angioedema)/i, label: 'Acute Anaphylaxis / Airway Angioedema' }
  ],
  URGENT: [
    { pattern: /(acute\s*abdomen|appendicitis|pancreatitis|peritonitis|severe\s*abdominal\s*pain|severe\s*stomach\s*pain)/i, label: 'Acute Abdomen / Severe Abdominal Distress' },
    { pattern: /(vomit(ing)?\s*blood|hematemesis|black\s*stool|coffee\s*ground|melena)/i, label: 'Gastrointestinal Hemorrhage' },
    { pattern: /(cough(ing)?\s*blood|hemoptysis)/i, label: 'Isolated Hemoptysis' },
    { pattern: /(acute\s*mountain\s*sickness|altitude\s*sickness)/i, label: 'Acute Mountain Sickness' },
    { pattern: /(deep\s*vein\s*thrombosis|dvt|calf\s*swelling|painful\s*swollen\s*leg)/i, label: 'Suspected Deep Vein Thrombosis' }
  ],
  ROUTINE: [
    { pattern: /(cold|common\s*cold|coryza|rhinitis|runny\s*nose|stuffy\s*nose|sneezing|nasal\s*congestion|जुकाम|सर्दी)/i, label: 'Common Cold / Acute Viral Coryza' },
    { pattern: /(mild\s*cough|dry\s*cough|wet\s*cough|cough(?!.*blood)|throat\s*clearing|खांसी)/i, label: 'Mild Cough / Bronchial Irritation' },
    { pattern: /(sore\s*throat|pharyngitis|throat\s*irritation|scratchy\s*throat|गले\s*में\s*खराश)/i, label: 'Sore Throat / Viral Pharyngitis' },
    { pattern: /(mild\s*fever|low\s*grade\s*fever|flu\s*like|mild\s*malaise|halka\s*bukhar|हल्का\s*बुखार)/i, label: 'Mild Low-Grade Viral Fever' },
    { pattern: /(tension\s*headache|mild\s*headache|routine\s*headache)/i, label: 'Mild Tension Headache' },
    { pattern: /(indigestion|acidity|acid\s*reflux|gerd|heartburn|mild\s*stomach\s*upset|dyspepsia|gas|अपच|खट्टी\s*डकार)/i, label: 'Mild Indigestion / Dyspepsia / Acidity' },
    { pattern: /(mild\s*diarrhea|loose\s*motion|constipation)/i, label: 'Mild Gastrointestinal Irritation' },
    { pattern: /(mild\s*sprain|muscle\s*strain|body\s*ache|mild\s*back\s*pain|minor\s*joint\s*pain|बदन\s*दर्द|कमर\s*दर्द)/i, label: 'Mild Musculoskeletal Strain / Sprain' },
    { pattern: /(minor\s*rash|itching|insect\s*bite|minor\s*scratch|skin\s*allergy)/i, label: 'Minor Dermatological Irritation' },
    { pattern: /(routine\s*checkup|general\s*checkup|health\s*checkup|consultation|follow\s*up|regular\s*visit|routine\s*visit|prescription\s*refill|annual\s*checkup)/i, label: 'Routine Consultation / Health Checkup' }
  ]
};

/**
 * Identify any recognized routine illness patterns in patient complaint text.
 */
function matchRoutineIllness(textCorpus) {
  for (const item of CLINICAL_ILLNESS_TAXONOMY.ROUTINE) {
    if (item.pattern.test(textCorpus)) {
      return item.label;
    }
  }
  return null;
}

/**
 * Unified Multi-System Patient Triage Evaluator.
 * Accepts any patient or session payload and returns definitive triage level, score, reason, and action.
 */
function evaluateMultiSystemTriage(sessionOrPatient) {
  const flags = detectRedFlags(sessionOrPatient);
  const sessionId = sessionOrPatient.session_id || sessionOrPatient.sessionId || sessionOrPatient.patientId || `PT-${Date.now()}`;

  // Synthesize Altitude Context & Pattern Recognition
  const altitudeEval = evaluateAltitudeExposure(sessionOrPatient);
  if (altitudeEval.patternsDetected.includes('HACE_CONSIDERATION') && !flags.some(f => f.flag_type === 'altitude_hace_consideration')) {
    flags.push({
      flag_id: `FLAG-${sessionId}-HACE-${Date.now()}`,
      flag_type: 'altitude_hace_consideration',
      urgency_tier: 'critical',
      detected_at: new Date(),
      status: 'active',
      reason: 'High-Altitude Cerebral Edema (HACE) Consideration: Acute neurological findings / ataxia following recent ascent. Emergent descent and medical evaluation required.'
    });
  }

  if (altitudeEval.patternsDetected.includes('HAPE_CONSIDERATION') && !flags.some(f => f.flag_type === 'altitude_hape_consideration')) {
    flags.push({
      flag_id: `FLAG-${sessionId}-HAPE-${Date.now()}`,
      flag_type: 'altitude_hape_consideration',
      urgency_tier: 'critical',
      detected_at: new Date(),
      status: 'active',
      reason: 'High-Altitude Pulmonary Edema (HAPE) Consideration: Respiratory symptoms and marked hypoxemia in an unacclimatized patient. Urgent physician evaluation required.'
    });
  }

  if (altitudeEval.patternsDetected.includes('AMS_CONTEXT') && !flags.some(f => f.flag_type === 'altitude_ams_context')) {
    flags.push({
      flag_id: `FLAG-${sessionId}-AMS-${Date.now()}`,
      flag_type: 'altitude_ams_context',
      urgency_tier: 'urgent',
      detected_at: new Date(),
      status: 'active',
      reason: 'Acute Mountain Sickness (AMS) Clinical Pattern: Headache with compatible symptoms (nausea, dizziness, fatigue) after recent ascent. Symptomatic care and monitoring required.'
    });
  }

  const criticalFlags = flags.filter(f => f.urgency_tier === 'critical');
  const urgentFlags = flags.filter(f => f.urgency_tier === 'urgent');

  const textCorpus = extractAllTextCorpus(sessionOrPatient);
  const matchedRoutine = matchRoutineIllness(textCorpus);

  let triageLevel = 'ROUTINE';
  let urgencyTier = 'routine';
  let urgencyScore = 3;
  let action = 'STANDARD_QUEUE';
  let reason = '';

  if (criticalFlags.length > 0) {
    triageLevel = 'EMERGENCY';
    urgencyTier = 'critical';
    urgencyScore = 10;
    action = 'IMMEDIATE_DOCTOR_ALERT';
    const reasons = criticalFlags.map(f => `• ${f.reason}`).join('\n');
    const addendum = urgentFlags.length > 0
      ? `\nCo-occurring urgent findings:\n` + urgentFlags.map(f => `• ${f.reason}`).join('\n')
      : '';
    reason = `CRITICAL RED-FLAG ALERT:\n${reasons}${addendum}`;
  } else if (urgentFlags.length > 0) {
    triageLevel = 'URGENT';
    urgencyTier = 'urgent';
    urgencyScore = 7;
    action = 'PRIORITY_REVIEW';
    reason = `PRIORITY CLINICAL REVIEW REQUIRED:\n` + urgentFlags.map(f => `• ${f.reason}`).join('\n');
  } else {
    triageLevel = 'ROUTINE';
    urgencyTier = 'routine';
    urgencyScore = 3;
    action = 'STANDARD_QUEUE';
    if (matchedRoutine) {
      reason = `Patient presents with routine condition (${matchedRoutine}). Vitals and physiological indicators are within stable parameters. No red-flag criteria triggered. Assigned to standard outpatient queue.`;
    } else {
      reason = 'Patient vitals and reported symptoms are within stable physiological limits. No red-flag criteria triggered. Assigned to standard queue.';
    }
  }

  return {
    triageLevel,
    urgencyTier,
    urgencyScore,
    action,
    reason,
    matchedRoutineCondition: matchedRoutine,
    redFlags: flags,
    redFlagCount: flags.length,
    altitudeContext: altitudeEval,
    timestamp: new Date().toISOString()
  };
}

/**
 * Merge newly-detected flags into the session's existing red_flags, keyed by
 * flag_type, WITHOUT clobbering a flag a physician already acknowledged/resolved.
 */
function mergeRedFlags(existingFlags = [], newFlags = []) {
  const byType = new Map(existingFlags.map(f => [f.flag_type, f]));
  for (const nf of newFlags) {
    const existing = byType.get(nf.flag_type);
    if (!existing || existing.status === 'resolved') {
      byType.set(nf.flag_type, nf);
    }
  }
  return Array.from(byType.values());
}

module.exports = {
  detectRedFlags,
  evaluateMultiSystemTriage,
  normalizePatientVitals,
  mergeRedFlags
};
