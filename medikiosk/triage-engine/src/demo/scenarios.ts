import { PatientEvent } from '../schemas/patientEvent.js';

export interface DemoStep {
  stepNumber: number;
  label: string;
  delayMs: number;
  event: PatientEvent;
  expectedTriageLevel: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
  expectedTriggeredRules?: string[];
  notes: string;
}

export interface DemoScenario {
  caseId: 1 | 2 | 3;
  title: string;
  patientName: string;
  abhaId: string;
  sessionId: string;
  clinicalSummary: string;
  steps: DemoStep[];
}

export const DEMO_SCENARIOS: Record<1 | 2 | 3, DemoScenario> = {
  1: {
    caseId: 1,
    title: 'Case 1: Routine Assessment (Stable Musculoskeletal Sprain)',
    patientName: 'Ramesh Kumar (Age 34)',
    abhaId: 'ABHA_9921_3321',
    sessionId: 'kiosk_sih_demo_case1_routine',
    clinicalSummary: 'Patient presents with mild wrist pain after carrying heavy luggage. Normal vitals, no red flags.',
    steps: [
      {
        stepNumber: 1,
        label: 'Symptom Ingestion: Right Wrist Pain (Severity 3/10)',
        delayMs: 800,
        event: {
          id: 'demo_c1_evt_01',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case1_routine',
          patientId: 'ABHA_9921_3321',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_SYMPTOM_ADDED',
          payload: {
            symptomName: 'SPRAINED_WRIST',
            severity: 3,
            site: 'RIGHT_ARM',
            onset: 'ACUTE',
            durationMinutes: 120,
            radiation: [],
            associatedSymptoms: [],
            exacerbatingFactors: [],
            relievingFactors: []
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Initial intake baseline established as ROUTINE.'
      },
      {
        stepNumber: 2,
        label: 'Hardware Vitals: Automated Pulse Oximeter & BP (SpO2 98%, HR 72 bpm, BP 118/76 mmHg)',
        delayMs: 1000,
        event: {
          id: 'demo_c1_evt_02',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case1_routine',
          source: 'HARDWARE_DAEMON',
          eventType: 'NEW_VITAL_READING',
          payload: {
            vitalType: 'BLOOD_PRESSURE',
            value: { systolic: 118, diastolic: 76 },
            unit: 'mmHg',
            deviceSource: 'BLE_BP_CUFF',
            measurementQuality: 'HIGH'
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Normal physiological baseline confirmed.'
      },
      {
        stepNumber: 3,
        label: 'SOCRATES Dynamic Question: Pain Quality answered as "Dull Aching"',
        delayMs: 900,
        event: {
          id: 'demo_c1_evt_03',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case1_routine',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_QUESTIONNAIRE_ANSWER',
          payload: {
            questionId: 'SOCRATES_CHARACTER',
            questionText: 'How would you describe the feeling or quality of the pain?',
            category: 'GENERAL',
            questionType: 'SINGLE_CHOICE',
            answerValue: 'DULL_ACHING'
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Non-ischemic quality reinforces stable musculoskeletal presentation.'
      },
      {
        stepNumber: 4,
        label: 'Red-Flag Screening: Anticoagulant use answered as "False"',
        delayMs: 800,
        event: {
          id: 'demo_c1_evt_04',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case1_routine',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_QUESTIONNAIRE_ANSWER',
          payload: {
            questionId: 'MED_ON_BLOOD_THINNERS',
            questionText: 'Are you currently taking blood thinners?',
            category: 'MEDICATION_HISTORY',
            questionType: 'BOOLEAN',
            answerValue: false
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Patient finishes questionnaire in STANDARD_QUEUE with zero active alarms.'
      }
    ]
  },

  2: {
    caseId: 2,
    title: 'Case 2: Urgent Escalation (Cough with Moderate Hypoxemia SpO2 92%)',
    patientName: 'Sunita Sharma (Age 58)',
    abhaId: 'ABHA_4412_8819',
    sessionId: 'kiosk_sih_demo_case2_urgent',
    clinicalSummary: 'Patient presents with subacute cough. Pulse oximetry reveals SpO2 of 92%, triggering priority review without halting questionnaire.',
    steps: [
      {
        stepNumber: 1,
        label: 'Symptom Ingestion: Persistent Productive Cough (Severity 4/10)',
        delayMs: 800,
        event: {
          id: 'demo_c2_evt_01',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case2_urgent',
          patientId: 'ABHA_4412_8819',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_SYMPTOM_ADDED',
          payload: {
            symptomName: 'PERSISTENT_COUGH',
            severity: 4,
            site: 'CHEST',
            onset: 'GRADUAL_SUBACUTE',
            radiation: [],
            associatedSymptoms: [],
            exacerbatingFactors: [],
            relievingFactors: []
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Initial complaint alone is evaluated as ROUTINE.'
      },
      {
        stepNumber: 2,
        label: 'Hardware Vital: Pulse Oximeter reads SpO2 = 92% (Moderate Hypoxemia)',
        delayMs: 1100,
        event: {
          id: 'demo_c2_evt_02',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case2_urgent',
          source: 'HARDWARE_DAEMON',
          eventType: 'NEW_VITAL_READING',
          payload: {
            vitalType: 'SPO2',
            value: 92,
            unit: '%',
            deviceSource: 'BLE_PULSE_OXIMETER',
            measurementQuality: 'HIGH'
          }
        },
        expectedTriageLevel: 'URGENT',
        expectedTriggeredRules: ['RULE_RESPIRATORY_MODERATE_HYPOXEMIA'],
        notes: 'Escalates to URGENT (PRIORITY_REVIEW). Questionnaire continues to gather diagnostic context.'
      },
      {
        stepNumber: 3,
        label: 'Respiratory Screening: Hemoptysis (Coughing blood) answered "False"',
        delayMs: 900,
        event: {
          id: 'demo_c2_evt_03',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case2_urgent',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_QUESTIONNAIRE_ANSWER',
          payload: {
            questionId: 'COUGH_WITH_BLOOD',
            questionText: 'Are you coughing up blood?',
            category: 'RESPIRATORY',
            questionType: 'BOOLEAN',
            answerValue: false
          }
        },
        expectedTriageLevel: 'URGENT',
        expectedTriggeredRules: ['RULE_RESPIRATORY_MODERATE_HYPOXEMIA'],
        notes: 'Confirmed non-massive hemoptysis; priority remains URGENT for physician review.'
      }
    ]
  },

  3: {
    caseId: 3,
    title: 'Case 3: Critical Emergency (Suspected ACS: Chest Pain + Left Arm Radiation + Diaphoresis)',
    patientName: 'Vikramaditya Verma (Age 52)',
    abhaId: 'ABHA_1008_7762',
    sessionId: 'kiosk_sih_demo_case3_emergency',
    clinicalSummary: 'Patient reports chest tightness. The moment radiation to left arm and diaphoresis are detected, the engine triggers EMERGENCY, halts questionnaire, and alerts doctor workstation.',
    steps: [
      {
        stepNumber: 1,
        label: 'Symptom Ingestion: Chest Discomfort (Severity 6/10)',
        delayMs: 800,
        event: {
          id: 'demo_c3_evt_01',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case3_emergency',
          patientId: 'ABHA_1008_7762',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'NEW_SYMPTOM_ADDED',
          payload: {
            symptomName: 'CHEST_DISCOMFORT',
            severity: 6,
            site: 'CHEST',
            onset: 'ACUTE',
            radiation: [],
            associatedSymptoms: [],
            exacerbatingFactors: [],
            relievingFactors: []
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Initial isolated discomfort is noted.'
      },
      {
        stepNumber: 2,
        label: 'Hardware Vital: Blood Pressure Cuff measures 124/80 mmHg',
        delayMs: 900,
        event: {
          id: 'demo_c3_evt_02',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case3_emergency',
          source: 'HARDWARE_DAEMON',
          eventType: 'NEW_VITAL_READING',
          payload: {
            vitalType: 'BLOOD_PRESSURE',
            value: { systolic: 124, diastolic: 80 },
            unit: 'mmHg',
            deviceSource: 'BLE_BP_CUFF',
            measurementQuality: 'HIGH'
          }
        },
        expectedTriageLevel: 'ROUTINE',
        notes: 'Hemodynamics are stable, awaiting dynamic diagnostic inputs.'
      },
      {
        stepNumber: 3,
        label: 'Dynamic Intake: Patient confirms Left Arm Radiation & Cold Sweating (ACS Red Flag)',
        delayMs: 1200,
        event: {
          id: 'demo_c3_evt_03',
          timestamp: new Date().toISOString(),
          sessionId: 'kiosk_sih_demo_case3_emergency',
          source: 'KIOSK_TOUCHSCREEN',
          eventType: 'ASSOCIATED_SYMPTOM_DETECTED',
          payload: {
            symptomName: 'CHEST_DISCOMFORT',
            severity: 8,
            site: 'CHEST',
            onset: 'ACUTE',
            radiation: ['LEFT_ARM'],
            associatedSymptoms: ['SWEATING'],
            exacerbatingFactors: [],
            relievingFactors: []
          }
        },
        expectedTriageLevel: 'EMERGENCY',
        expectedTriggeredRules: ['RULE_CARDIAC_ACS_RED_FLAG', 'RULE_GENERAL_SEVERE_PAIN'],
        notes: 'EMERGENCY ESCALATION FIRED IN REAL TIME: Questionnaire interrupted, doctor alerted immediately.'
      }
    ]
  }
};
