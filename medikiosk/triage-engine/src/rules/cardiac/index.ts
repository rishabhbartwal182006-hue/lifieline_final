import { Rule } from '../types.js';

/**
 * ============================================================================
 * CARDIAC TRIAGE RULES
 * ============================================================================
 */

export const CARDIAC_RULES: Rule[] = [
  {
    id: 'RULE_CARDIAC_DIRECT_HEART_ATTACK',
    name: 'Acute Myocardial Infarction / Heart Attack Report',
    category: 'cardiac',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.symptomName',
        operator: 'includes',
        value: 'HEART_ATTACK'
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Acute Myocardial Infarction Alert: Patient reports acute heart attack / coronary syndrome symptoms. Immediate ECG and resuscitation pathway activated.',
    metadata: {
      guidelineSource: 'AHA/ACC Chest Pain & ACS Guidelines',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_CARDIAC_ACS_RED_FLAG',
    name: 'Acute Coronary Syndrome (ACS) Red Flag Presentation',
    category: 'cardiac',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.site',
        operator: 'equals',
        value: 'CHEST'
      },
      {
        field: 'symptoms.allRadiations',
        operator: 'includes',
        value: 'LEFT_ARM'
      },
      {
        field: 'symptoms.allAssociatedSymptoms',
        operator: 'includes',
        value: 'SWEATING'
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Possible Acute Coronary Syndrome: Patient reports acute chest pain with radiation to the left arm accompanied by diaphoresis (profuse sweating).',
    metadata: {
      guidelineSource: 'AHA/ACC Chest Pain Guidelines (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_CARDIAC_CHEST_PAIN_HYPOTENSION',
    name: 'Chest Pain with Hemodynamic Compromise',
    category: 'cardiac',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.site',
        operator: 'equals',
        value: 'CHEST'
      },
      {
        field: 'vitals.BLOOD_PRESSURE.value.systolic',
        operator: 'lessThan',
        value: 90
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Cardiogenic Shock / Unstable Angina Alert: Acute chest pain presenting concurrently with profound hypotension (Systolic BP < 90 mmHg).',
    metadata: {
      guidelineSource: 'Emergency Triage Protocols (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_CARDIAC_CHEST_PAIN_DYSPNEA',
    name: 'Chest Pain with Associated Dyspnea',
    category: 'cardiac',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.site',
        operator: 'equals',
        value: 'CHEST'
      },
      {
        field: 'symptoms.allAssociatedSymptoms',
        operator: 'includes',
        value: 'SHORTNESS_OF_BREATH'
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'High-Risk Cardiac Presentation: Acute chest pain presenting with acute dyspnea (shortness of breath).',
    metadata: {
      guidelineSource: 'ESC Guidelines on Acute Coronary Syndromes',
      isDemoPlaceholder: true
    }
  }
];
