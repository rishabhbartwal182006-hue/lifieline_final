import { Rule } from '../types.js';

/**
 * ============================================================================
 * NEUROLOGICAL TRIAGE RULES
 * ============================================================================
 */

export const NEUROLOGICAL_RULES: Rule[] = [
  {
    id: 'RULE_NEURO_THUNDERCLAP_HEADACHE',
    name: 'Thunderclap Headache Presentation',
    category: 'neurological',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.site',
        operator: 'equals',
        value: 'HEAD'
      },
      {
        field: 'symptoms.primary.onset',
        operator: 'equals',
        value: 'SUDDEN_THUNDERCLAP'
      },
      {
        field: 'symptoms.primary.severity',
        operator: 'greaterThanOrEqual',
        value: 7
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Hyperacute Severe Headache (Thunderclap Onset): Instantaneous peak severe headache is a primary red flag for Subarachnoid Hemorrhage (SAH) or acute cerebral vascular crisis.',
    metadata: {
      guidelineSource: 'Emergency Medicine SNOOP Criteria (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_NEURO_STROKE_FAST',
    name: 'Acute Stroke Symptoms (FAST Criteria)',
    category: 'neurological',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.primary.symptomName',
        operator: 'includes',
        value: 'STROKE'
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Acute Stroke Alert: Patient presents with acute focal neurological deficits (FAST criteria). Emergent neuroimaging and thrombolysis pathway activated.',
    metadata: {
      guidelineSource: 'AHA/ASA Acute Ischemic Stroke Guidelines',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_NEURO_UNCONSCIOUS_SYNCOPE',
    name: 'Acute Loss of Consciousness / Syncope',
    category: 'neurological',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'symptoms.allAssociatedSymptoms',
        operator: 'includes',
        value: 'LOSS_OF_CONSCIOUSNESS'
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Transient or Persistent Loss of Consciousness Alert: Patient presents with syncope or acute altered responsiveness requiring immediate evaluation.',
    metadata: {
      guidelineSource: 'Emergency Medicine Syncope Risk Stratification',
      isDemoPlaceholder: true
    }
  }
];
