/**
 * ============================================================================
 * TEST SUITE: URGENT TRIAGE SCENARIOS (COMBINATION OF ABNORMAL SIGNALS)
 * ============================================================================
 * Demonstrates that patients with moderate respiratory, cardiac rate,
 * high pain distress, or medication-risk signals escalate to URGENT.
 */

import { processPatientEvent, clearAllSessions } from '../src/engine/index.js';

export function runUrgentTests(): boolean {
  console.log('\n======================================================================');
  console.log('🟡 TEST SUITE: URGENT CASES (MODERATE ABNORMALITIES & RISK SIGNALS)');
  console.log('======================================================================\n');

  clearAllSessions();
  let allPassed = true;

  // --------------------------------------------------------------------------
  // SCENARIO 1: Moderate Hypoxemia (SpO2 92%)
  // --------------------------------------------------------------------------
  console.log('[SCENARIO 1] Patient with mild cough who presents with SpO2 = 92%...');
  const sess1 = 'kiosk_sess_urgent_001';

  // Event 1: Symptom entry
  const res1_1 = processPatientEvent({
    id: 'evt_urg_1_1',
    timestamp: '2026-08-30T11:00:00.000Z',
    sessionId: sess1,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'PERSISTENT_COUGH',
      severity: 4,
      site: 'CHEST',
      onset: 'GRADUAL_SUBACUTE'
    }
  });
  console.log(`  Step 1 Result: ${res1_1.triageLevel}`);

  // Event 2: SpO2 reading from sensor (92%)
  const res1_2 = processPatientEvent({
    id: 'evt_urg_1_2',
    timestamp: '2026-08-30T11:01:00.000Z',
    sessionId: sess1,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'SPO2',
      value: 92,
      unit: '%',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  });

  console.log(`  Step 2 Result after SpO2 (92%): ${res1_2.triageLevel}`);
  console.log(`  Triggered Rules: ${res1_2.triggeredRules.join(', ')}`);
  console.log(`  Action: ${res1_2.action}`);

  if (
    res1_2.triageLevel === 'URGENT' &&
    res1_2.action === 'PRIORITY_REVIEW' &&
    res1_2.triggeredRules.includes('RULE_RESPIRATORY_MODERATE_HYPOXEMIA')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to URGENT (Moderate Hypoxemia).\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 1 failed to escalate to URGENT.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 2: Marked Tachycardia (Heart Rate = 158 bpm)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 2] Patient with Palpitations and HR = 158 bpm...');
  const sess2 = 'kiosk_sess_urgent_002';

  const res2 = processPatientEvent({
    id: 'evt_urg_2_1',
    timestamp: '2026-08-30T11:05:00.000Z',
    sessionId: sess2,
    source: 'HARDWARE_DAEMON',
    eventType: 'NEW_VITAL_READING',
    payload: {
      vitalType: 'HEART_RATE',
      value: 158,
      unit: 'bpm',
      deviceSource: 'BLE_PULSE_OXIMETER'
    }
  });

  console.log(`  Result Triage Level: ${res2.triageLevel}`);
  console.log(`  Triggered Rules: ${res2.triggeredRules.join(', ')}`);

  if (
    res2.triageLevel === 'URGENT' &&
    res2.triggeredRules.includes('RULE_VITALS_SEVERE_TACHYCARDIA')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to URGENT (Marked Tachycardia).\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 2 failed to escalate to URGENT.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 3: Severe Pain Distress (9/10 Acute Back Spasm)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 3] Patient reporting severe pain (9/10 acute lumbar spasm)...');
  const sess3 = 'kiosk_sess_urgent_003';

  const res3 = processPatientEvent({
    id: 'evt_urg_3_1',
    timestamp: '2026-08-30T11:10:00.000Z',
    sessionId: sess3,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'LUMBAR_BACK_SPASM',
      severity: 9,
      site: 'BACK_LOWER',
      onset: 'ACUTE'
    }
  });

  console.log(`  Result Triage Level: ${res3.triageLevel}`);
  console.log(`  Triggered Rules: ${res3.triggeredRules.join(', ')}`);

  if (
    res3.triageLevel === 'URGENT' &&
    res3.triggeredRules.includes('RULE_GENERAL_SEVERE_PAIN')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to URGENT (Severe Pain Distress).\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 3 failed to escalate to URGENT.\x1b[0m');
    allPassed = false;
  }

  // --------------------------------------------------------------------------
  // SCENARIO 4: Head Pain on Anticoagulants (Cross-domain symptom + questionnaire)
  // --------------------------------------------------------------------------
  console.log('\n[SCENARIO 4] Head injury/pain in patient taking blood thinners...');
  const sess4 = 'kiosk_sess_urgent_004';

  // Step 1: Head pain reported
  processPatientEvent({
    id: 'evt_urg_4_1',
    timestamp: '2026-08-30T11:15:00.000Z',
    sessionId: sess4,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_SYMPTOM_ADDED',
    payload: {
      symptomName: 'HEAD_CONTUSION_PAIN',
      severity: 4,
      site: 'HEAD',
      onset: 'ACUTE'
    }
  });

  // Step 2: Questionnaire reveals blood thinner medication
  const res4_2 = processPatientEvent({
    id: 'evt_urg_4_2',
    timestamp: '2026-08-30T11:16:00.000Z',
    sessionId: sess4,
    source: 'KIOSK_TOUCHSCREEN',
    eventType: 'NEW_QUESTIONNAIRE_ANSWER',
    payload: {
      questionId: 'MED_ON_BLOOD_THINNERS',
      questionText: 'Are you taking anticoagulant medications?',
      category: 'MEDICATION_HISTORY',
      questionType: 'BOOLEAN',
      answerValue: true
    }
  });

  console.log(`  Result after questionnaire: ${res4_2.triageLevel}`);
  console.log(`  Triggered Rules: ${res4_2.triggeredRules.join(', ')}`);

  if (
    res4_2.triageLevel === 'URGENT' &&
    res4_2.triggeredRules.includes('RULE_SCREENING_ANTICOAGULANT_HEAD_INJURY')
  ) {
    console.log('  \x1b[32m✔ PASS: Correctly escalated to URGENT (Anticoagulant Head Risk).\x1b[0m');
  } else {
    console.log('  \x1b[31m✘ FAIL: Scenario 4 failed to escalate to URGENT.\x1b[0m');
    allPassed = false;
  }

  return allPassed;
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  const ok = runUrgentTests();
  process.exit(ok ? 0 : 1);
}
