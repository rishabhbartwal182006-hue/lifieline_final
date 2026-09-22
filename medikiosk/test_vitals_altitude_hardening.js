/**
 * test_vitals_altitude_hardening.js
 *
 * Clinical & Software Verification Suite for:
 * 1. Zero-default hardware vitals ingestion (No fake "120/80" or "98")
 * 2. Pure raw SpO2 preservation
 * 3. Altitude as clinical context, NEVER vital correction
 * 4. Invariant: Altitude CANNOT downgrade clinical severity
 * 5. Syndrome pattern detection: AMS_CONTEXT, HAPE_CONSIDERATION, HACE_CONSIDERATION
 * 6. Discrepancy engine handles unmeasured vitals safely
 */

const assert = require('assert');
const { evaluateMultiSystemTriage, normalizePatientVitals, detectRedFlags } = require('./services/redFlagRules');
const { evaluateAltitudeExposure } = require('./services/altitudeRiskService');
const { evaluateClinicalDiscrepancies } = require('./services/discrepancyEngine');

console.log('================================================================');
console.log('🧪 VERIFYING VITALS HARDENING & ALTITUDE EXPOSURE ARCHITECTURE');
console.log('================================================================\n');

// -------------------------------------------------------------------------
// TEST 1: Zero-Default Hardware Vitals Ingestion
// -------------------------------------------------------------------------
console.log('[TEST 1] Zero-Default Hardware Vitals Ingestion (No fake 120/80 or 98)');
const unmeasuredVitals = { bp: '', spo2: '', heartRate: '', bloodSugar: '' };
const normalized = normalizePatientVitals(unmeasuredVitals);

assert.strictEqual(normalized.systolic, undefined, 'Systolic BP must be undefined when unmeasured');
assert.strictEqual(normalized.diastolic, undefined, 'Diastolic BP must be undefined when unmeasured');
assert.strictEqual(normalized.spo2, undefined, 'SpO2 must be undefined when unmeasured');
assert.strictEqual(normalized.heartRate, undefined, 'Heart Rate must be undefined when unmeasured');
console.log('  ✔ PASS: Unmeasured vitals are undefined (no fake "120/80" or "98" injected)');

// -------------------------------------------------------------------------
// TEST 2: Discrepancy Engine Safety with Missing Vitals
// -------------------------------------------------------------------------
console.log('\n[TEST 2] Discrepancy Engine Safety (No fake 120/98/72 contradiction alerts)');
const discResult = evaluateClinicalDiscrepancies({
  chiefComplaints: [{ symptom: 'Severe generalized weakness', severity: 'Severe' }],
  vitals: {} // completely empty vitals
});
const hasFakeContradiction = discResult.discrepancies.some(d => d.flagId.startsWith('DISC_SEVERE_NORMAL_VITALS'));
assert.strictEqual(hasFakeContradiction, false, 'Must not assume 120/98/72 to falsely claim vitals are normal');
console.log('  ✔ PASS: Discrepancy engine safely skips contradiction checks when vitals are unmeasured');

// -------------------------------------------------------------------------
// TEST 3: Sea-Level / Unconfigured Facility (Standard Clinical Protocol)
// -------------------------------------------------------------------------
console.log('\n[TEST 3] Sea-Level / Unconfigured Facility (SpO2 88% -> Emergency)');
const seaLevelCase = evaluateMultiSystemTriage({
  symptoms: ['Mild cough for 2 days'],
  environment: { altitudeMeters: 100 },
  vitals: { spo2: '88' }
});
assert.strictEqual(seaLevelCase.triageLevel, 'EMERGENCY', 'SpO2 88% at sea level must be EMERGENCY');
assert.ok(seaLevelCase.redFlags.some(f => f.flag_type === 'critical_hypoxemia'), 'Triggered critical hypoxemia');
assert.strictEqual(seaLevelCase.altitudeContext.altitudeContext, 'NONE', 'Altitude context inactive at 100m');
console.log('  ✔ PASS: Sea-level hypoxemia triggers EMERGENCY without altitude interference');

// -------------------------------------------------------------------------
// TEST 4: Long-Term Resident with Severe Hypoxemia (CANNOT BE EXEMPTED BY ALTITUDE)
// -------------------------------------------------------------------------
console.log('\n[TEST 4] Resident Severe Hypoxemia (3,050m + Resident + SpO2 82% + Dyspnea)');
const residentSevere = evaluateMultiSystemTriage({
  symptoms: ['Shortness of breath at rest', 'Cough'],
  altitudeContext: {
    facilityAltitudeM: 3050,
    exposure: {
      usualSleepingAltitudeM: 3050,
      currentSleepingAltitudeM: 3050,
      isLongTermResident: true
    }
  },
  vitals: { bp: '130/82', spo2: '82', heartRate: '105' }
});
assert.strictEqual(residentSevere.triageLevel, 'EMERGENCY', 'Severe hypoxemia in resident MUST NOT be excused by altitude');
assert.ok(residentSevere.redFlags.some(f => f.urgency_tier === 'critical'), 'Critical red flags present');
console.log('  ✔ PASS: Resident with SpO2 82% and dyspnea remains EMERGENCY (Invariant holds)');

// -------------------------------------------------------------------------
// TEST 5: Acute Traveler with Severe Hypoxemia (HAPE Consideration)
// -------------------------------------------------------------------------
console.log('\n[TEST 5] Acute Traveler Severe Hypoxemia (3,050m + Arrived 12h ago + SpO2 82% + Dyspnea)');
const travelerHape = evaluateMultiSystemTriage({
  symptoms: ['Breathlessness at rest', 'Dry cough'],
  altitudeContext: {
    facilityAltitudeM: 3050,
    exposure: {
      usualSleepingAltitudeM: 200,
      currentSleepingAltitudeM: 3050,
      hoursAtCurrentAltitude: 12,
      isLongTermResident: false
    }
  },
  vitals: { bp: '132/84', spo2: '82', heartRate: '110' }
});
assert.strictEqual(travelerHape.triageLevel, 'EMERGENCY', 'Acute traveler with hypoxemia + dyspnea is EMERGENCY');
assert.ok(travelerHape.redFlags.some(f => f.flag_type === 'altitude_hape_consideration'), 'Triggered HAPE consideration flag');
assert.strictEqual(travelerHape.altitudeContext.altitudeContext, 'SIGNIFICANT', 'Significant acute hypoxic exposure');
console.log('  ✔ PASS: Traveler with SpO2 82% + dyspnea triggers EMERGENCY with HAPE consideration');

// -------------------------------------------------------------------------
// TEST 6: Classic AMS Pattern (Recent Ascent + Headache + Nausea/Dizziness)
// -------------------------------------------------------------------------
console.log('\n[TEST 6] Classic AMS Pattern (2,800m + Arrived 18h ago + Headache + Nausea + Stable SpO2 91%)');
const amsCase = evaluateMultiSystemTriage({
  symptoms: ['Severe headache', 'Nausea', 'Dizziness'],
  altitudeContext: {
    facilityAltitudeM: 2800,
    exposure: {
      usualSleepingAltitudeM: 150,
      currentSleepingAltitudeM: 2800,
      hoursAtCurrentAltitude: 18,
      isLongTermResident: false
    }
  },
  vitals: { bp: '122/78', spo2: '91', heartRate: '78' }
});
assert.strictEqual(amsCase.triageLevel, 'URGENT', 'AMS clinical pattern triggers URGENT review');
assert.ok(amsCase.redFlags.some(f => f.flag_type === 'possible_acute_mountain_sickness' || f.flag_type === 'altitude_ams_context'), 'AMS red flag detected');
console.log('  ✔ PASS: AMS pattern recognized as URGENT without creating false cardiac/stroke emergencies');

// -------------------------------------------------------------------------
// TEST 7: Healthy Long-Term Resident Checkup (No False Emergency)
// -------------------------------------------------------------------------
console.log('\n[TEST 7] Healthy Long-Term Resident Checkup (2,800m + Resident + SpO2 91% + No Symptoms)');
const healthyResident = evaluateMultiSystemTriage({
  symptoms: ['Routine health checkup'],
  altitudeContext: {
    facilityAltitudeM: 2800,
    exposure: {
      usualSleepingAltitudeM: 2800,
      currentSleepingAltitudeM: 2800,
      isLongTermResident: true
    }
  },
  vitals: { bp: '118/76', spo2: '91', heartRate: '70' }
});
assert.strictEqual(healthyResident.triageLevel, 'ROUTINE', 'Healthy resident checkup must be ROUTINE');
assert.strictEqual(healthyResident.redFlags.length, 0, 'No red flags for healthy resident');
console.log('  ✔ PASS: Healthy resident with SpO2 91% has 0 red flags and routes to ROUTINE queue');

console.log('\n================================================================');
console.log('🎉 ALL 7 ARCHITECTURAL & CLINICAL VERIFICATION TESTS PASSED!');
console.log('================================================================');
