/**
 * ============================================================================
 * TEST SUITE: ESCALATION TRIAGE SCENARIOS (REAL-TIME EMERGENCY TRIGGERS)
 * ============================================================================
 * Demonstrates that the engine escalates to EMERGENCY in real-time on the EXACT
 * event that completes a clinical red-flag pattern (not via batch polling).
 */

import { processPatientEvent, clearAllSessions } from '../src/engine/index.js';

export function runEscalationTests(): boolean {
  console.log('\n======================================================================');
  console.log('🔴 TEST SUITE: ESCALATION CASES (REAL-TIME CRITICAL RED-FLAG TRIGGERS)');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;

  // --------------------------------------------------------------------------
  // SCENARIO 1: Acute Coronary Syndrome (ACS) Real-Time Escalation
  // --------------------------------------------------------------------------
  console.log('[SCENARIO 1] Event-by-event ACS Red-Flag Escalation:');
  const sess1 = 'kiosk_sess_acs_001';

  // STEP 1: Chest discomfort without radiation or sweating (Baseline)
  console.log('  -> Step 1: Ingesting chest pain (severity 6, no radiation yet)...');
  const res1 = processPatientEvent({
    id: 'evt_acs_01',
    timestamp: '2026-08-30T12:00:00.000Z',
    sessionId: sess1,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'CHEST_DISCOMFORT',
      severity: 6,
      site: 'CHEST',
      onset: 'ACUTE',
      radiation: [],
      associatedSymptoms: []
    }
  });
  console.log(`     Step 1 Triage Level: ${res1.triageLevel} | Triggered Rules: [${res1.triggeredRules.join(', ')}]`);
  if (res1.triageLevel !== 'ROUTINE') {
    console.log('  \x1b[31m✘ FAIL: Step 1 should be ROUTINE before red flags are added.\x1b[0m');
    allPassed = false;
  }

  // STEP 2: Normal vital signs recorded
  console.log('  -> Step 2: Hardware records normal vitals (BP 120/80 mmHg, HR 78 bpm)...');
  const res2 = processPatientEvent({
    id: 'evt_acs_02',
    timestamp: '2026-08-30T12:01:00.000Z',
    sessionId: sess1,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'BLOOD_PRESSURE',
      value: { systolic: 120, diastolic: 80 },
      unit: 'mmHg',
      deviceSource: 'BLE_BP_CUFF'
    }
  });
  console.log(`     Step 2 Triage Level: ${res2.triageLevel} | Triggered Rules: [${res2.triggeredRules.join(', ')}]`);
  if (res2.triageLevel !== 'ROUTINE') {
    console.log('  \x1b[31m✘ FAIL: Step 2 should remain ROUTINE.\x1b[0m');
    allPassed = false;
  }

  // STEP 3: Patient completes interactive questionnaire revealing Left Arm Radiation & Sweating
  console.log('  -> Step 3: Patient confirms Left Arm radiation & Diaphoresis (Sweating)...');
  const res3 = processPatientEvent({
    id: 'evt_acs_03',
    timestamp: '2026-08-30T12:02:15.000Z',
    sessionId: sess1,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'ASSOCIATED_SYMPTOM_DETECTED',
    payload: {
      symptomName: 'CHEST_DISCOMFORT',
      severity: 7,
      site: 'CHEST',
      onset: 'ACUTE',
      radiation: ['LEFT_ARM'],
      associatedSymptoms: ['SWEATING']
    }
  });

  console.log(`\n     \x1b[33m⚡ REAL-TIME REACTION ON STEP 3:\x1b[0m`);
  console.log(`     Triage Level: \x1b[31m${res3.triageLevel}\x1b[0m`);
  console.log(`     Action: \x1b[31m${res3.action}\x1b[0m`);
  console.log(`     Triggered Rules: ${res3.triggeredRules.join(', ')}`);
  console.log(`     Clinical Reason:\n     ${res3.reason.replace(/\n/g, '\n     ')}`);

  if (
    res3.triageLevel === 'EMERGENCY' &&
    res3.action === 'IMMEDIATE_DOCTOR_ALERT' &&
    res3.triggeredRules.includes('RULE_CARDIAC_ACS_RED_FLAG')
  ) {
    console.log('\n  \x1b[32m✔ PASS: Engine immediately reacted on Step 3 and escalated to EMERGENCY.\x1b[0m');
  } else {
    console.log('\n  \x1b[31m✘ FAIL: Scenario 1 failed to escalate to EMERGENCY on Step 3.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Thunderclap Headache (Instant Emergency on Single Ingestion)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 2] Thunderclap Headache Presentation (Instant SAH Screening Flag)...');
  const sess2 = 'kiosk_sess_sah_002';

  const resThunderclap = processPatientEvent({
    id: 'evt_sah_01',
    timestamp: '2026-08-30T12:05:00.000Z',
    sessionId: sess2,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'THUNDERCLAP_HEADACHE',
      severity: 8,
      site: 'HEAD',
      onset: 'SUDDEN_THUNDERCLAP',
      durationMinutes: 15,
      character: 'SHARP_STABBING'
    }
  });

  console.log(`  Result Triage Level: ${resThunderclap.triageLevel}`);
  console.log(`  Triggered Rules: ${resThunderclap.triggeredRules.join(', ')}`);
  console.log(`  Action: ${resThunderclap.action}`);

  if (
    resThunderclap.triageLevel === 'EMERGENCY' &&
    resThunderclap.action === 'IMMEDIATE_DOCTOR_ALERT' &&
    resThunderclap.triggeredRules.includes('RULE_NEURO_THUNDERCLAP_HEADACHE')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to EMERGENCY on thunderclap headache.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 2 failed to escalate to EMERGENCY.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Critical Hypoxemia (SpO2 = 86%)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 3] Critical Hypoxemia (SpO2 = 86%)...');
  const sess3 = 'kiosk_sess_hypox_003';

  const resHypox = processPatientEvent({
    id: 'evt_hypox_01',
    timestamp: '2026-08-30T12:10:00.000Z',
    sessionId: sess3,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'SPO2',
      value: 86,
      unit: '%',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  });

  console.log(`  Result Triage Level: ${resHypox.triageLevel}`);
  console.log(`  Triggered Rules: ${resHypox.triggeredRules.join(', ')}`);

  if (
    resHypox.triageLevel === 'EMERGENCY' &&
    resHypox.triggeredRules.includes('RULE_RESPIRATORY_CRITICAL_HYPOXEMIA')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to EMERGENCY on critical SpO2 < 90%.\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 3 failed to escalate to EMERGENCY.\x1b[0m');
    allPassed = false;
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const ok = runEscalationTests();
  process.exit(ok ? 0 : 1);
}
