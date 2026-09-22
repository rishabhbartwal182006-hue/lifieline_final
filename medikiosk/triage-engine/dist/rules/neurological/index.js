/**
 * ============================================================================
 * NEUROLOGICAL TRIAGE RULES (DEMO PLACEHOLDERS)
 * ============================================================================
 * ⚠️ DISCLAIMER FOR SIH EVALUATION:
 * The neurological screening patterns below are demo placeholders
 * inspired by Emergency Medicine Red-Flag Headache protocols (SNOOP criteria).
 */
export const NEUROLOGICAL_RULES = [
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
    }
];
