/**
 * ============================================================================
 * MEDIKIOSK TRIAGE ENGINE - PHASE 1 VALIDATION TEST SUITE & DEMO
 * ============================================================================
 * Demonstrates strict type validation, SOCRATES symptom ingestion,
 * physiological range guarding, and structured error reporting.
 */

import { validatePatientEvent } from '../src/schemas/patientEvent.js';
import { TriageResultSchema } from '../src/schemas/triageResult.js';

interface TestCase {
  name: string;
  description: string;
  input: unknown;
  shouldPass: boolean;
  expectedErrorSubstring?: string;
}

const testCases: TestCase[] = [
  // --------------------------------------------------------------------------
  // TEST CASE 1: Valid Symptom Event (SOCRATES Framework)
  // --------------------------------------------------------------------------
  {
    name: 'TC-1: Valid Symptom Event (Acute Chest Pain with SOCRATES attributes)',
    description: 'Verifies that a fully populated symptom event matching the SOCRATES clinical schema passes validation.',
    shouldPass: true,
    input: {
      id: 'evt_symptom_001',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1001',
      patientId: 'ABHA_9921_3321',
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_SYMPTOM_ADDED',
      payload: {
        symptomName: 'CHEST_PAIN',
        severity: 8,
        site: 'CHEST',
        onset: 'SUDDEN_THUNDERCLAP',
        durationMinutes: 45,
        character: 'CRUSHING_HEAVY',
        radiation: ['LEFT_ARM', 'JAW'],
        associatedSymptoms: ['SWEATING', 'DYSPNEA', 'NAUSEA'],
        exacerbatingFactors: ['PHYSICAL_EXERTION'],
        relievingFactors: ['REST'],
        timeCourse: 'WORSENING_PROGRESSIVE',
        patientRemarks: 'Feels like heavy pressure on the left chest radiating to arm.'
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 2: Valid Vital Event (Blood Pressure from BLE Cuff)
  // --------------------------------------------------------------------------
  {
    name: 'TC-2: Valid Vital Reading (Blood Pressure)',
    description: 'Verifies that a structured blood pressure vital event from an automated peripheral passes validation.',
    shouldPass: true,
    input: {
      id: 'evt_vital_002',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1001',
      source: 'HARDWARE_DAEMON',
      eventType: 'NEW_VITAL_READING',
      payload: {
        vitalType: 'BLOOD_PRESSURE',
        value: {
          systolic: 128,
          diastolic: 82
        },
        unit: 'mmHg',
        deviceSource: 'BLE_BP_CUFF',
        measurementQuality: 'HIGH',
        deviceId: 'OMRON_HEM_7120_SN8812',
        sampledAt: new Date().toISOString()
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 3: Valid Questionnaire Response (Red-Flag Screening)
  // --------------------------------------------------------------------------
  {
    name: 'TC-3: Valid Questionnaire Response (Red-Flag Anticoagulant Check)',
    description: 'Verifies that structured questionnaire answers pass clinical validation.',
    shouldPass: true,
    input: {
      id: 'evt_quest_003',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1001',
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_QUESTIONNAIRE_ANSWER',
      payload: {
        questionId: 'MED_ON_BLOOD_THINNERS',
        questionText: 'Are you currently taking any blood thinning medications (e.g. Warfarin, Aspirin)?',
        category: 'MEDICATION_HISTORY',
        questionType: 'BOOLEAN',
        answerValue: true,
        responseLatencySeconds: 4.2
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 4: Missing Required Field (Missing sessionId & symptom severity)
  // --------------------------------------------------------------------------
  {
    name: 'TC-4: Missing Required Fields (Missing severity and sessionId)',
    description: 'Verifies that events missing mandatory schema fields are rejected with specific field paths.',
    shouldPass: false,
    expectedErrorSubstring: 'severity',
    input: {
      id: 'evt_bad_004',
      timestamp: new Date().toISOString(),
      // sessionId missing!
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_SYMPTOM_ADDED',
      payload: {
        symptomName: 'HEADACHE',
        site: 'HEAD',
        onset: 'ACUTE'
        // severity missing!
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 5: Wrong Data Type (Severity as string instead of number)
  // --------------------------------------------------------------------------
  {
    name: 'TC-5: Wrong Data Type (String passed for numeric severity)',
    description: 'Verifies that type violations (e.g., severity: "severe" instead of 1-10 number) are caught immediately.',
    shouldPass: false,
    expectedErrorSubstring: 'Expected number, received string',
    input: {
      id: 'evt_bad_005',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1002',
      source: 'KIOSK_TOUCHSCREEN',
      eventType: 'NEW_SYMPTOM_ADDED',
      payload: {
        symptomName: 'ABDOMINAL_PAIN',
        severity: 'SEVERE', // INVALID: Expected number 0-10
        site: 'ABDOMEN_LOWER',
        onset: 'ACUTE'
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 6: Physiologically Impossible Vital Reading (Heart Rate = 450 bpm)
  // --------------------------------------------------------------------------
  {
    name: 'TC-6: Physiologically Impossible Vital Reading (HR = 450 bpm)',
    description: 'Verifies that hardware glitch/impossible biological values are flagged by the safety validator.',
    shouldPass: false,
    expectedErrorSubstring: 'outside physically possible biological limits',
    input: {
      id: 'evt_vital_006',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1003',
      source: 'HARDWARE_DAEMON',
      eventType: 'NEW_VITAL_READING',
      payload: {
        vitalType: 'HEART_RATE',
        value: 450, // INVALID: Beyond human survival limit (20-300 bpm)
        unit: 'bpm',
        deviceSource: 'BLE_PULSE_OXIMETER'
      }
    }
  },

  // --------------------------------------------------------------------------
  // TEST CASE 7: Invalid BP Logic (Systolic <= Diastolic)
  // --------------------------------------------------------------------------
  {
    name: 'TC-7: Invalid Blood Pressure Logic (Systolic <= Diastolic)',
    description: 'Verifies that physiological relationships (Systolic > Diastolic) are enforced.',
    shouldPass: false,
    expectedErrorSubstring: 'Systolic blood pressure must be greater than diastolic',
    input: {
      id: 'evt_vital_007',
      timestamp: new Date().toISOString(),
      sessionId: 'kiosk_sess_1004',
      source: 'HARDWARE_DAEMON',
      eventType: 'NEW_VITAL_READING',
      payload: {
        vitalType: 'BLOOD_PRESSURE',
        value: {
          systolic: 70,
          diastolic: 95 // INVALID: Diastolic cannot exceed Systolic
        },
        unit: 'mmHg',
        deviceSource: 'BLE_BP_CUFF'
      }
    }
  }
];

// ----------------------------------------------------------------------------
// Test Runner
// ----------------------------------------------------------------------------
export function runTests(): void {
  console.log('\n======================================================================');
  console.log('🩺 MEDIKIOSK TRIAGE ENGINE: PHASE 1 DATA CONTRACT TEST SUITE');
  console.log('======================================================================\n');

  let passed = 0;
  let failed = 0;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`[TEST ${i + 1}/${testCases.length}] ${tc.name}`);
    console.log(`  Description: ${tc.description}`);

    const result = validatePatientEvent(tc.input);

    if (tc.shouldPass) {
      if (result.success) {
        console.log('  \x1b[32m✔ PASS: Event successfully validated and normalized.\x1b[0m');
        console.log(`    Normalized Event Type: ${result.data.eventType}`);
        console.log(`    Session ID: ${result.data.sessionId}`);
        passed++;
      } else {
        console.log('  \x1b[31m✘ FAIL: Expected event to pass, but validation failed:\x1b[0m');
        console.log(`    Error: ${result.error}`);
        failed++;
      }
    } else {
      if (!result.success) {
        let match = true;
        if (tc.expectedErrorSubstring) {
          const serializedErrors = JSON.stringify(result.errors);
          match = serializedErrors.toLowerCase().includes(tc.expectedErrorSubstring.toLowerCase()) ||
                  result.error.toLowerCase().includes(tc.expectedErrorSubstring.toLowerCase());
        }

        if (match) {
          console.log('  \x1b[32m✔ PASS: Malformed event properly rejected with structured error.\x1b[0m');
          console.log(`    Captured Error: ${result.error}`);
          console.log(`    Issue Details:`, JSON.stringify(result.errors, null, 2).replace(/\n/g, '\n    '));
          passed++;
        } else {
          console.log('  \x1b[31m✘ FAIL: Rejected, but error did not match expected substring:\x1b[0m');
          console.log(`    Expected substring: "${tc.expectedErrorSubstring}"`);
          console.log(`    Actual errors: ${JSON.stringify(result.errors)}`);
          failed++;
        }
      } else {
        console.log('  \x1b[31m✘ FAIL: Expected event to be rejected, but it unexpectedly PASSED validation!\x1b[0m');
        failed++;
      }
    }
    console.log('----------------------------------------------------------------------');
  }

  // Also verify TriageResult schema output contract
  console.log('\n[TEST OUTPUT CONTRACT] Validating TriageResult Schema Contract:');
  const sampleTriageResult = {
    id: 'trg_res_9001',
    sessionId: 'kiosk_sess_1001',
    patientId: 'ABHA_9921_3321',
    triageLevel: 'EMERGENCY',
    triggeredRules: [
      'RULE_CHEST_PAIN_THUNDERCLAP_ONSET',
      'RULE_CARDIOVASCULAR_RADIATION_DETECTED'
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Patient presents with severe crushing chest pain (8/10), sudden thunderclap onset radiating to left arm and jaw with diaphoresis and dyspnea.',
    timestamp: new Date().toISOString(),
    metadata: {
      news2Score: 7,
      redFlagCount: 2,
      evaluationLatencyMs: 14.5
    }
  };

  const parsedResult = TriageResultSchema.safeParse(sampleTriageResult);
  if (parsedResult.success) {
    console.log('  \x1b[32m✔ PASS: TriageResult schema correctly validated and shaped.\x1b[0m');
    console.log('  Sample Triage Output Payload:');
    console.log(' ', JSON.stringify(parsedResult.data, null, 2).replace(/\n/g, '\n  '));
    passed++;
  } else {
    console.log('  \x1b[31m✘ FAIL: TriageResult schema parsing failed:\x1b[0m', parsedResult.error);
    failed++;
  }

  console.log('\n======================================================================');
  console.log(`TEST RUN SUMMARY: ${passed} Passed, ${failed} Failed out of ${testCases.length + 1} Total Tests`);
  console.log('======================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests when executed directly
runTests();
