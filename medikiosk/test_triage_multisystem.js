/**
 * test_triage_multisystem.js
 * Comprehensive Multi-System Triage & Red-Flag Engine Verification
 */

const { evaluateMultiSystemTriage, normalizePatientVitals, detectRedFlags } = require('./services/redFlagRules');

console.log('================================================================');
console.log('🧪 RUNNING MULTI-SYSTEM TRIAGE & RED-FLAG ENGINE TESTS');
console.log('================================================================\n');

let allPassed = true;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  \x1b[32m✔ PASS:\x1b[0m ${testName}`);
  } else {
    console.log(`  \x1b[31m✘ FAIL:\x1b[0m ${testName} ${details ? `(${details})` : ''}`);
    allPassed = false;
  }
}

// -------------------------------------------------------------------------
// TEST 1: CARDIAC EMERGENCY (Heart Attack Presentation)
// -------------------------------------------------------------------------
console.log('[SCENARIO 1] Cardiac Emergency (Heart Attack / ACS)');
const case1 = evaluateMultiSystemTriage({
  symptoms: ['Patient having a heart attack', 'Chest pain'],
  vitals: { bp: '120/80', spo2: '98', heartRate: 78 }
});
assert(case1.triageLevel === 'EMERGENCY', 'Classified as EMERGENCY', `Got: ${case1.triageLevel}`);
assert(case1.urgencyTier === 'critical', 'Urgency tier is critical', `Got: ${case1.urgencyTier}`);
assert(case1.redFlags.some(f => f.flag_type === 'acute_cardiac_event'), 'Triggered acute_cardiac_event red flag');

// -------------------------------------------------------------------------
// TEST 1b: CHEST PAIN WITH LEFT ARM RADIATION & SWEATING
// -------------------------------------------------------------------------
const case1b = evaluateMultiSystemTriage({
  symptoms: ['Chest discomfort'],
  hpi: { radiation: 'Left arm', associated: 'Sweating' },
  vitals: { bp: '130/85', spo2: '97' }
});
assert(case1b.triageLevel === 'EMERGENCY', 'Chest pain + radiation + sweating is EMERGENCY', `Got: ${case1b.triageLevel}`);

// -------------------------------------------------------------------------
// TEST 2: NEUROLOGICAL EMERGENCY (Acute Stroke FAST)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 2] Neurological Emergency (Stroke FAST Criteria)');
const case2 = evaluateMultiSystemTriage({
  symptoms: ['Sudden facial droop and right arm weakness', 'Slurred speech'],
  vitals: { bp: '140/90', spo2: '98' }
});
assert(case2.triageLevel === 'EMERGENCY', 'Classified as EMERGENCY', `Got: ${case2.triageLevel}`);
assert(case2.redFlags.some(f => f.flag_type === 'acute_stroke_fast_alert'), 'Triggered acute_stroke_fast_alert red flag');

// -------------------------------------------------------------------------
// TEST 3: RESPIRATORY EMERGENCY (Critical Hypoxemia SpO2 < 90%)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 3] Respiratory Emergency (Severe Hypoxemia)');
const case3 = evaluateMultiSystemTriage({
  symptoms: ['Cough', 'Difficulty breathing'],
  vitals: { bp: '118/75', spo2: '86', heartRate: 104 }
});
assert(case3.triageLevel === 'EMERGENCY', 'Classified as EMERGENCY', `Got: ${case3.triageLevel}`);
assert(case3.redFlags.some(f => f.flag_type === 'critical_hypoxemia' || f.flag_type === 'severe_hypoxia'), 'Triggered critical hypoxemia flag');

// -------------------------------------------------------------------------
// TEST 4: METABOLIC - ISOLATED SEVERE HYPERGLYCEMIA (Glucose 380 mg/dL, No DKA)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 4] Metabolic (Isolated Severe Hyperglycemia 380 mg/dL - No DKA)');
const case4 = evaluateMultiSystemTriage({
  symptoms: ['Mild fatigue', 'Routine checkup'],
  vitals: { bp: '125/80', spo2: '98', bloodSugar: '380 mg/dL' }
});
assert(case4.triageLevel === 'URGENT', 'Isolated Glucose 380 mg/dL is URGENT (Not Emergency)', `Got: ${case4.triageLevel}`);
assert(case4.urgencyTier === 'urgent', 'Urgency tier is urgent', `Got: ${case4.urgencyTier}`);
assert(case4.redFlags.some(f => f.flag_type === 'isolated_severe_hyperglycemia'), 'Triggered isolated_severe_hyperglycemia flag');

// -------------------------------------------------------------------------
// TEST 5: METABOLIC - HYPERGLYCEMIC CRISIS (DKA: Glucose 380 mg/dL + Vomiting + Tachypnea)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 5] Metabolic (Hyperglycemic Crisis / DKA with Vomiting)');
const case5 = evaluateMultiSystemTriage({
  symptoms: ['Vomiting', 'Rapid breathing', 'Abdominal pain'],
  vitals: { bp: '110/70', spo2: '96', bloodSugar: 380 }
});
assert(case5.triageLevel === 'EMERGENCY', 'Glucose 380 mg/dL WITH DKA symptoms is EMERGENCY', `Got: ${case5.triageLevel}`);
assert(case5.redFlags.some(f => f.flag_type === 'hyperglycemic_crisis_dka'), 'Triggered hyperglycemic_crisis_dka flag');

// -------------------------------------------------------------------------
// TEST 6: HYPERTENSIVE CRISIS (BP 195/115 mmHg)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 6] Hypertensive Crisis (BP 195/115 mmHg)');
const case6 = evaluateMultiSystemTriage({
  symptoms: ['Headache'],
  vitals: { bp: '195/115', spo2: '98' }
});
assert(case6.triageLevel === 'EMERGENCY', 'BP 195/115 is EMERGENCY', `Got: ${case6.triageLevel}`);
assert(case6.redFlags.some(f => f.flag_type === 'hypertensive_crisis'), 'Triggered hypertensive_crisis flag');

// -------------------------------------------------------------------------
// TEST 7: ACUTE ABDOMEN
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 7] Acute Abdomen (Severe Right Lower Quadrant Pain)');
const case7 = evaluateMultiSystemTriage({
  symptoms: ['Severe abdominal pain', 'Possible appendicitis'],
  vitals: { bp: '122/80', spo2: '98', temperature: 38.0 }
});
assert(case7.triageLevel === 'URGENT', 'Severe abdominal pain is URGENT', `Got: ${case7.triageLevel}`);
assert(case7.redFlags.some(f => f.flag_type === 'acute_abdomen'), 'Triggered acute_abdomen flag');

// -------------------------------------------------------------------------
// TEST 8: HIGH-ALTITUDE (Acute Mountain Sickness at 3500m)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 8] High-Altitude AMS (3500m + Headache + Dizziness)');
const case8 = evaluateMultiSystemTriage({
  symptoms: ['Headache', 'Dizziness', 'Nausea'],
  environment: { altitudeMeters: 3500 },
  vitals: { bp: '120/80', spo2: '90' }
});
assert(case8.triageLevel === 'URGENT', 'AMS at 3500m is URGENT', `Got: ${case8.triageLevel}`);
assert(case8.redFlags.some(f => f.flag_type === 'possible_acute_mountain_sickness'), 'Triggered AMS flag');

// -------------------------------------------------------------------------
// TEST 9: ROUTINE CASE (Mild Cold / Stable Vitals)
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 9] Routine Encounter (Mild Cold, Normal Vitals)');
const case9 = evaluateMultiSystemTriage({
  symptoms: ['Mild cold for 2 days', 'Slight runny nose'],
  vitals: { bp: '120/80', spo2: '98', heartRate: 72, bloodSugar: '110 mg/dL' }
});
assert(case9.triageLevel === 'ROUTINE', 'Classified as ROUTINE', `Got: ${case9.triageLevel}`);
assert(case9.redFlags.length === 0, 'Zero red flags for routine cold');

// -------------------------------------------------------------------------
// TEST 10: HARDWARE VITALS NORMALIZATION & SENSOR COMPATIBILITY
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 10] Hardware Vitals Normalization');
const parsedVitals = normalizePatientVitals({
  bp: '135/85',
  spo2: '96',
  bloodSugar: '142 mg/dL',
  heart_rate: '74'
});
assert(parsedVitals.systolic === 135 && parsedVitals.diastolic === 85, 'Parsed BP string 135/85');
assert(parsedVitals.spo2 === 96, 'Parsed SpO2 96');
assert(parsedVitals.bloodGlucose === 142, 'Parsed blood sugar 142 mg/dL');
assert(parsedVitals.heartRate === 74, 'Parsed heart rate 74');

// -------------------------------------------------------------------------
// TEST 11: 3-TIER ROUTINE ILLNESS ORDERING (Direct 'Cold', 'Runny Nose')
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 11] Direct Cold as a Disease Intake');
const case11 = evaluateMultiSystemTriage({
  symptoms: ['Cold'],
  chiefComplaint: 'Cold',
  vitals: { bp: '120/80', spo2: '98', heartRate: 72, bloodSugar: '95' }
});
assert(case11.triageLevel === 'ROUTINE', 'Direct Cold classified strictly as ROUTINE', `Got: ${case11.triageLevel}`);
assert(case11.urgencyTier === 'routine', 'Tier is routine', `Got: ${case11.urgencyTier}`);
assert(case11.action === 'STANDARD_QUEUE', 'Assigned to standard queue', `Got: ${case11.action}`);
assert(case11.matchedRoutineCondition.includes('Common Cold'), 'Matched Common Cold routine condition');
assert(case11.redFlags.length === 0, 'Zero red flags triggered for cold');

// -------------------------------------------------------------------------
// TEST 12: UPPER RESPIRATORY MULTI-SYMPTOM ROUTINE ENCOUNTER
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 12] Upper Respiratory Viral Complex (Cold + Runny Nose + Sore Throat)');
const case12 = evaluateMultiSystemTriage({
  chiefComplaint: 'Common Cold',
  symptoms: ['Cold', 'Runny nose', 'Mild sore throat'],
  vitals: { bp: '122/82', spo2: '97', heartRate: 78, bloodSugar: '102' }
});
assert(case12.triageLevel === 'ROUTINE', 'Multi-symptom cold classified as ROUTINE', `Got: ${case12.triageLevel}`);
assert(case12.redFlags.length === 0, 'Zero red flags');

// -------------------------------------------------------------------------
// TEST 13: ROUTINE CHECKUP / GENERAL CONSULTATION
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 13] General Routine Health Checkup');
const case13 = evaluateMultiSystemTriage({
  chiefComplaint: 'Routine Health Checkup',
  symptoms: ['General Consultation', 'Blood pressure follow-up'],
  vitals: { bp: '125/80', spo2: '98', heartRate: 70, bloodSugar: '98' }
});
assert(case13.triageLevel === 'ROUTINE', 'Routine health checkup classified as ROUTINE', `Got: ${case13.triageLevel}`);
assert(case13.matchedRoutineCondition.includes('Routine Consultation'), 'Matched Routine Consultation');

// -------------------------------------------------------------------------
// TEST 14: SAFETY INVARIANT - COLD WITH ACUTE DYSPNEA / SEVERE HYPOXEMIA
// -------------------------------------------------------------------------
console.log('\n[SCENARIO 14] Clinical Safety: Cold with Acute Dyspnea & Critical Hypoxemia (SpO2 86%)');
const case14 = evaluateMultiSystemTriage({
  chiefComplaint: 'Cold with severe difficulty breathing',
  symptoms: ['Cold', 'Shortness of breath'],
  vitals: { bp: '120/80', spo2: '86', heartRate: 110 }
});
assert(case14.triageLevel === 'EMERGENCY', 'Escalates to EMERGENCY due to critical hypoxemia < 90%', `Got: ${case14.triageLevel}`);
assert(case14.redFlags.some(f => f.flag_type === 'critical_hypoxemia' || f.flag_type === 'severe_hypoxia'), 'Critical hypoxemia flag raised');

console.log('\n================================================================');
if (allPassed) {
  console.log('🎉 ALL MULTI-SYSTEM TRIAGE & RED-FLAG TESTS PASSED PERFECTLY!');
} else {
  console.log('❌ SOME TESTS FAILED.');
  process.exit(1);
}
console.log('================================================================');

