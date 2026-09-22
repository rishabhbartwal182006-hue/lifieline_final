/**
 * SOCRATES Dynamic Questionnaire Flow
 *
 * Implements the clinical SOCRATES assessment framework with dynamic branching:
 * - Omits radiation questions when pain is localized to isolated digits/extremities.
 * - Prioritizes autonomic red-flag questions for torso/head presentations.
 */
export const SOCRATES_QUESTION_DEFINITIONS = {
    SITE: (defaultSite) => ({
        questionId: 'SOCRATES_SITE',
        questionText: 'Where exactly is the main pain or discomfort located?',
        category: 'GENERAL',
        questionType: 'SINGLE_CHOICE',
        options: [
            { label: 'Chest / Breastbone', value: 'CHEST' },
            { label: 'Head / Forehead / Scalp', value: 'HEAD' },
            { label: 'Upper Abdomen / Stomach', value: 'ABDOMEN_UPPER' },
            { label: 'Lower Abdomen / Pelvis', value: 'ABDOMEN_LOWER' },
            { label: 'Upper Back / Shoulder Blades', value: 'BACK_UPPER' },
            { label: 'Lower Back / Lumbar', value: 'BACK_LOWER' },
            { label: 'Neck / Throat', value: 'NECK' },
            { label: 'Left Arm / Shoulder', value: 'LEFT_ARM' },
            { label: 'Right Arm / Shoulder', value: 'RIGHT_ARM' },
            { label: 'Leg / Knee / Ankle', value: 'LEFT_LEG' },
            { label: 'Other / Generalized Body', value: 'GENERALIZED_BODY' }
        ],
        helpText: 'Touch the region on screen that feels most painful.'
    }),
    ONSET: () => ({
        questionId: 'SOCRATES_ONSET',
        questionText: 'How quickly did this pain or symptom start?',
        category: 'GENERAL',
        questionType: 'SINGLE_CHOICE',
        options: [
            { label: 'Instantaneous peak like a thunderclap (< 1 min)', value: 'SUDDEN_THUNDERCLAP' },
            { label: 'Rapidly over the last few hours (< 24 hours)', value: 'ACUTE' },
            { label: 'Gradually over the past several days', value: 'GRADUAL_SUBACUTE' },
            { label: 'Persistent chronic discomfort (> 2 weeks)', value: 'CHRONIC' }
        ],
        helpText: 'Sudden instantaneous onset is a critical diagnostic indicator.',
        isRedFlagIndicator: true
    }),
    CHARACTER: () => ({
        questionId: 'SOCRATES_CHARACTER',
        questionText: 'How would you describe the feeling or quality of the pain?',
        category: 'GENERAL',
        questionType: 'SINGLE_CHOICE',
        options: [
            { label: 'Crushing, heavy pressure, or squeezing band', value: 'CRUSHING_HEAVY' },
            { label: 'Sharp, stabbing, or piercing knife-like pain', value: 'SHARP_STABBING' },
            { label: 'Dull, persistent ache', value: 'DULL_ACHING' },
            { label: 'Burning or searing sensation', value: 'BURNING' },
            { label: 'Throbbing or pulsating rhythm', value: 'THROBBING' },
            { label: 'Cramping or waves of colicky pain', value: 'CRAMPING_COLICKY' },
            { label: 'Tingling or electric shock', value: 'ELECTRIC_TINGLING' }
        ],
        helpText: 'Select the description that best captures the sensation.'
    }),
    RADIATION: (site) => ({
        questionId: 'SOCRATES_RADIATION',
        questionText: 'Does the pain spread or shoot to any other part of your body?',
        category: site === 'CHEST' || site === 'NECK' ? 'CARDIOVASCULAR' : 'GENERAL',
        questionType: 'MULTI_CHOICE',
        options: [
            { label: 'No, pain stays in one exact spot', value: 'NONE' },
            { label: 'Left Arm / Shoulder', value: 'LEFT_ARM' },
            { label: 'Jaw / Teeth / Neck', value: 'JAW' },
            { label: 'Through to the Upper Back / Shoulder Blades', value: 'BACK_UPPER' },
            { label: 'Down into the Lower Back / Buttocks / Legs', value: 'LEGS' },
            { label: 'Right Arm / Shoulder', value: 'RIGHT_ARM' }
        ],
        helpText: 'Select all locations where you feel the pain spreading.',
        isRedFlagIndicator: true
    }),
    ASSOCIATED_SYMPTOMS: (site) => ({
        questionId: 'SOCRATES_ASSOCIATED',
        questionText: 'Are you experiencing any of these other symptoms at the same time?',
        category: site === 'CHEST' ? 'CARDIOVASCULAR' : 'RED_FLAG_SCREENING',
        questionType: 'MULTI_CHOICE',
        options: [
            { label: 'Cold profuse sweating / clamminess (Diaphoresis)', value: 'SWEATING' },
            { label: 'Shortness of breath / difficulty catching breath', value: 'DYSPNEA' },
            { label: 'Nausea, upset stomach, or vomiting', value: 'NAUSEA' },
            { label: 'Dizziness, lightheadedness, or feeling faint', value: 'DIZZINESS' },
            { label: 'Rapid, pounding heartbeats (Palpitations)', value: 'PALPITATIONS' },
            { label: 'None of the above', value: 'NONE' }
        ],
        helpText: 'Select all co-occurring symptoms you notice.',
        isRedFlagIndicator: true
    }),
    TIMING: () => ({
        questionId: 'SOCRATES_TIMING',
        questionText: 'Is the pain constant or does it come and go?',
        category: 'GENERAL',
        questionType: 'SINGLE_CHOICE',
        options: [
            { label: 'Constant and getting progressively worse', value: 'WORSENING_PROGRESSIVE' },
            { label: 'Constant with steady severity', value: 'CONSTANT_PERSISTENT' },
            { label: 'Intermittent episodes (comes and goes in waves)', value: 'INTERMITTENT_FLUCTUATING' },
            { label: 'Gradually improving', value: 'IMPROVING' }
        ]
    }),
    EXACERBATING_FACTORS: () => ({
        questionId: 'SOCRATES_EXACERBATING',
        questionText: 'What makes the pain feel worse or brings it on?',
        category: 'GENERAL',
        questionType: 'SINGLE_CHOICE',
        options: [
            { label: 'Physical exertion / walking / climbing stairs', value: 'PHYSICAL_EXERTION' },
            { label: 'Taking a deep breath / coughing (Pleuritic)', value: 'DEEP_BREATHING' },
            { label: 'Lying flat on your back (Orthopnea)', value: 'LYING_FLAT' },
            { label: 'Pressing on the painful area with your fingers', value: 'PALPATION_TOUCH' },
            { label: 'Eating food or after meals', value: 'AFTER_MEALS' },
            { label: 'Nothing specific makes it worse', value: 'NONE' }
        ]
    }),
    SEVERITY: () => ({
        questionId: 'SOCRATES_SEVERITY',
        questionText: 'On a scale from 0 to 10, how severe is your pain right now?',
        category: 'GENERAL',
        questionType: 'NUMERIC',
        options: [
            { label: '0 - No pain', value: 0 },
            { label: '1 to 3 - Mild discomfort', value: 2 },
            { label: '4 to 6 - Moderate pain interfering with tasks', value: 5 },
            { label: '7 to 8 - Severe pain requiring immediate attention', value: 8 },
            { label: '9 to 10 - Worst imaginable agonizing pain', value: 10 }
        ],
        helpText: '0 = No pain at all, 10 = Worst pain imaginable.',
        isRedFlagIndicator: true
    })
};
/**
 * Returns an ordered SOCRATES question sequence adapted to the symptom and anatomical site.
 */
export function getSocratesQuestionSequence(symptomName, site) {
    const normSite = site?.toUpperCase();
    const sequence = [];
    if (!site) {
        sequence.push(SOCRATES_QUESTION_DEFINITIONS.SITE());
    }
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.ONSET());
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.CHARACTER());
    const radiatingSites = ['CHEST', 'NECK', 'HEAD', 'BACK_UPPER', 'BACK_LOWER', 'ABDOMEN_UPPER', 'ABDOMEN_LOWER', 'PELVIS_GROIN'];
    if (!normSite || radiatingSites.includes(normSite)) {
        sequence.push(SOCRATES_QUESTION_DEFINITIONS.RADIATION(normSite));
    }
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.ASSOCIATED_SYMPTOMS(normSite));
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.TIMING());
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.EXACERBATING_FACTORS());
    sequence.push(SOCRATES_QUESTION_DEFINITIONS.SEVERITY());
    return sequence;
}
