import { Rule } from '../types.js';

/**
 * ============================================================================
 * GENERAL & SCREENING TRIAGE RULES (DEMO PLACEHOLDERS)
 * ============================================================================
 * ⚠️ DISCLAIMER FOR SIH EVALUATION:
 * These general pain severity and medication interaction flags are illustrative demo rules.
 */

export const GENERAL_RULES: Rule[] = [
  {
    id: 'RULE_GENERAL_SEVERE_PAIN',
    name: 'Severe Acute Pain Distress (Severity >= 8/10)',
    category: 'general',
    priority: 'URGENT',
    conditions: [
      {
        field: 'symptoms.maxSeverity',
        operator: 'greaterThanOrEqual',
        value: 8
      }
    ],
    action: 'PRIORITY_REVIEW',
    reason: 'Severe Pain Distress: Patient reports high-intensity pain (severity >= 8/10), requiring prioritized clinician review and analgesia assessment.',
    metadata: {
      guidelineSource: 'Emergency Severity Index (ESI) Level 3 Pain Criterion (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_SCREENING_ANTICOAGULANT_HEAD_INJURY',
    name: 'Head Injury/Pain on Anticoagulant Therapy',
    category: 'general',
    priority: 'URGENT',
    conditions: [
      {
        field: 'questionnaire.MED_ON_BLOOD_THINNERS.answerValue',
        operator: 'equals',
        value: true
      },
      {
        field: 'symptoms.primary.site',
        operator: 'equals',
        value: 'HEAD'
      }
    ],
    action: 'PRIORITY_REVIEW',
    reason: 'High Intracranial Hemorrhage Risk: Head pain or trauma reported in a patient actively taking anticoagulant/antiplatelet medications.',
    metadata: {
      guidelineSource: 'NICE Head Injury Guidelines (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  }
];
