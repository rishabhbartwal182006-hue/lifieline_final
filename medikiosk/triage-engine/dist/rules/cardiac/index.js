/**
 * ============================================================================
 * CARDIAC TRIAGE RULES (DEMO PLACEHOLDERS)
 * ============================================================================
 * ⚠️ DISCLAIMER FOR SIH EVALUATION:
 * The thresholds and conditions below are illustrative demonstration models
 * for the hackathon architecture. They must undergo formal review, calibration,
 * and approval by certified clinical bodies (e.g. AHA/ESC/AIIMS) before any
 * real-world deployment.
 */
export const CARDIAC_RULES = [
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
    }
];
