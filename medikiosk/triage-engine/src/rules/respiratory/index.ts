import { Rule } from '../types.js';

/**
 * ============================================================================
 * RESPIRATORY TRIAGE RULES (DEMO PLACEHOLDERS)
 * ============================================================================
 * ⚠️ DISCLAIMER FOR SIH EVALUATION:
 * The SpO2 thresholds below (90% and 94%) are illustrative demonstration values
 * based on standard British Thoracic Society (BTS) / WHO pulse oximetry triage ranges.
 * Real deployments require physician review and configuration for target populations
 * (e.g., lower baseline targets for COPD patients).
 */

export const RESPIRATORY_RULES: Rule[] = [
  {
    id: 'RULE_RESPIRATORY_CRITICAL_HYPOXEMIA',
    name: 'Critical Hypoxemia (SpO2 < 90%)',
    category: 'respiratory',
    priority: 'EMERGENCY',
    conditions: [
      {
        field: 'vitals.SPO2.value',
        operator: 'lessThan',
        value: 90
      }
    ],
    action: 'IMMEDIATE_DOCTOR_ALERT',
    reason: 'Critical Hypoxemia: Oxygen saturation (SpO2) is dangerously low (< 90%). High risk of acute respiratory failure.',
    metadata: {
      guidelineSource: 'WHO Pulse Oximetry Guidelines (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  },
  {
    id: 'RULE_RESPIRATORY_MODERATE_HYPOXEMIA',
    name: 'Moderate Hypoxemia (SpO2 90% - 94%)',
    category: 'respiratory',
    priority: 'URGENT',
    conditions: [
      {
        field: 'vitals.SPO2.value',
        operator: 'between',
        value: [90, 94]
      }
    ],
    action: 'PRIORITY_REVIEW',
    reason: 'Moderate Hypoxemia: Oxygen saturation (SpO2) is sub-optimal (90-94%). Requires expedited evaluation and monitoring.',
    metadata: {
      guidelineSource: 'BTS Oxygen Triage (Demo Adaptation)',
      isDemoPlaceholder: true
    }
  }
];
