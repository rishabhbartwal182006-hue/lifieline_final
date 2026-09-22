/**
 * ============================================================================
 * TEST SUITE: ROUTINE TRIAGE SCENARIOS (MULTI-EVENT SEQUENCES)
 * ============================================================================
 * Demonstrates that normal, stable patients remain classified as ROUTINE
 * across consecutive intake steps (symptom entry -> vitals -> questionnaire).
 */

import { processPatientEvent, clearAllSessions, getSession } from '../src/engine/index.js';

export function runRoutineTests(): boolean {
  console.log('\n======================================================================');
  console.log('🟢 TEST SUITE: ROUTINE CASES (STABLE MULTI-EVENT SEQUENCE)');
  console.log('======================================================================\n');

  clearAllSessions();
  const sessionId = 'kiosk_sess_routine_001';
  let allPassed = true;

  // --------------------------------------------------------------------------
  // STEP 1: Patient enters mild sprained wrist on touchscreen
  // --------------------------------------------------------------------------
  console.log('[STEP 1] Ingesting mild symptom: Sprained Wrist (Severity 3/10)...');
  const event1 = {
    id: 'evt_rt_01',
    timestamp: '2026-08-30T10:00:00.000Z',
    sessionId,
    patientId: 'PATIENT_ROUTINE_101',
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'SPRAINED_WRIST',
      severity: 3,
      site: 'RIGHT_ARM',
      onset: 'ACUTE',
      durationMinutes: 120,
      character: 'DULL_ACHING',
      radiation: [],
      associatedSymptoms: ['MILD_SWELLING'],
      exacerbatingFactors: ['WRIST_ROTATION'],
      relievingFactors: ['ICE_PACK']
    }
  };

  const result1 = processPatientEvent(event1);
  console.log(`  Result 1 Triage Level: ${result1.triageLevel}`);
  console.log(`  Result 1 Action: ${result1.action}`);
  if (result1.triageLevel !== 'ROUTINE' || result1.triggeredRules.length !== 0) {
    console.log('  \x1b[31m✘ FAIL: Expected ROUTINE with 0 triggered rules on Step 1\x1b[0m');
    allPassed = false;
  } else {
    console.log('  \x1b[32m✔ PASS: Correctly classified as ROUTINE on symptom intake.\x1b[0m');
  }

  // --------------------------------------------------------------------------
  // STEP 2: Vital signs recorded by integrated hardware sensors (All Normal)
  // --------------------------------------------------------------------------
  console.log('\n[STEP 2] Ingesting normal vitals (SpO2 = 98%, HR = 72 bpm, BP = 118/76 mmHg)...');
  
  // 2a. SpO2 Reading
  const event2a = {
    id: 'evt_rt_02a',
    timestamp: '2026-08-30T10:01:00.000Z',
    sessionId,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'SPO2',
      value: 98,
      unit: '%',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  };
  const result2a = processPatientEvent(event2a);

  // 2b. Heart Rate Reading
  const event2b = {
    id: 'evt_rt_02b',
    timestamp: '2026-08-30T10:01:05.000Z',
    sessionId,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'HEART_RATE',
      value: 72,
      unit: 'bpm',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  };
  const result2b = processPatientEvent(event2b);

  // 2c. Blood Pressure Reading
  const event2c = {
    id: 'evt_rt_02c',
    timestamp: '2026-08-30T10:01:40.000Z',
    sessionId,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'BLOOD_PRESSURE',
      value: {
        systolic: 118,
        diastolic: 76
      },
      unit: 'mmHg',
      deviceSource: 'BLE_BP_CUFF'
    }
  };
  const result2c = processPatientEvent(event2c);

  console.log(`  Result after Vitals - Triage Level: ${result2c.triageLevel}`);
  console.log(`  Result after Vitals - Action: ${result2c.action}`);
  if (result2c.triageLevel !== 'ROUTINE' || result2c.triggeredRules.length !== 0) {
    console.log('  \x1b[31m✘ FAIL: Expected ROUTINE with 0 triggered rules after normal vitals\x1b[0m');
    allPassed = false;
  } else {
    console.log('  \x1b[32m✔ PASS: Stays ROUTINE following normal physiological readings.\x1b[0m');
  }

  // --------------------------------------------------------------------------
  // STEP 3: Screening questionnaire (No high-risk conditions)
  // --------------------------------------------------------------------------
  console.log('\n[STEP 3] Ingesting negative red-flag screening questionnaire answers...');
  const event3 = {
    id: 'evt_rt_03',
    timestamp: '2026-08-30T10:02:15.000Z',
    sessionId,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_QUESTIONNAIRE_ANSWER',
    payload: {
      questionId: 'MED_ON_BLOOD_THINNERS',
      questionText: 'Are you taking blood thinners?',
      category: 'MEDICATION_HISTORY',
      questionType: 'BOOLEAN',
      answerValue: false
    }
  };

  const finalResult = processPatientEvent(event3);
  console.log(`  Final Triage Level: ${finalResult.triageLevel}`);
  console.log(`  Final Action: ${finalResult.action}`);
  console.log(`  Final Reason:\n  ${finalResult.reason}`);

  const session = getSession(sessionId);
  console.log(`  Accumulated Session Events Count: ${session?.eventCount}`);

  if (
    finalResult.triageLevel === 'ROUTINE' &&
    finalResult.action === 'STANDARD_QUEUE' &&
    finalResult.triggeredRules.length === 0 &&
    session?.eventCount === 5
  ) {
    console.log('\n  \x1b[32m✔ ALL ROUTINE TESTS PASSED: Patient remained in standard queue throughout whole encounter.\x1b[0m');
  } else {
    console.log('\n  \x1b[31m✘ ROUTINE TEST SUITE FAILED.\x1b[0m');
    allPassed = false;
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const ok = runRoutineTests();
  process.exit(ok ? 0 : 1);
}
