import { Rule } from '../types.js';

/**
 * ============================================================================
 * PHYSIOLOGICAL VITALS TRIAGE RULES (DEMO PLACEHOLDERS)
 * ============================================================================
 * ⚠️ DISCLAIMER FOR SIH EVALUATION:
 * Vital parameter boundaries (HR < 40 or > 150 bpm, Systolic BP < 90 mmHg)
 * reflect simplified NEWS2 / emergency department trigger tiers for demonstration.
 */

export const VITALS_RULES: Rule[] = [
  {
    id: 'RULE_VITALS_SEVERE_TACHYCARDIA',
    name: 'Marked Tachycardia (HR > 150 bpm)',
    category: 'vitals',
    priority: 'URGENT',
    conditions: [
      {
        field: 'vitals.HEART_RATE.value',
        operator: 'greaterThan',
        value: 150
      }
    ],
    action: 'PRIORITY_REVIEW',
    reason: 'Marked Tachycardia: Resting heart rate exceeds 150 bpm, indicating acute hemodynamic distress, arrhythmia, or systemic decompensation.',
    metadata: {
      guidelineSource: 'NEWS2 Severe Tachycardia Protocol (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_VITALS_SEVERE_BRADYCARDIA',
    name: 'Severe Bradycardia (HR < 40 bpm)',
    category: 'vitals',
    priority: 'URGENT',
    conditions: [
      {
        field: 'vitals.HEART_RATE.value',
        operator: 'lessThan',
        value: 40
      }
    ],
    action: 'PRIORITY_REVIEW',
    reason: 'Severe Bradycardia: Resting heart rate below 40 bpm presents high risk of syncope or conduction block.',
    metadata: {
      guidelineSource: 'NEWS2 Severe Bradycardia Protocol (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_VITALS_HYPOTENSION_CRITICAL',
    name: 'Critical Hypotension (Systolic BP < 90 mmHg)',
    category: 'vitals',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'vitals.BLOOD_PRESSURE.value.systolic',
        operator: 'lessThan',
        value: 90
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Critical Hypotension: Systolic blood pressure below 90 mmHg indicates significant hemodynamic instability / imminent circulatory shock.',
    metadata: {
      guidelineSource: 'qSOFA / Shock Criteria (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  }
];
