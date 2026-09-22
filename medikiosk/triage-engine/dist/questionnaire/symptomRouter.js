import { getSocratesQuestionSequence } from './socratesFlow.js';
/**
 * Symptom Question Router
 *
 * Maps presenting complaints to targeted clinical decision questions
 * and red-flag screening batteries.
 */
export const DOMAIN_SCREENING_QUESTIONS = {
    MED_ON_BLOOD_THINNERS: {
        questionId: 'MED_ON_BLOOD_THINNERS',
        questionText: 'Are you currently taking any blood thinner or anticoagulant medications (e.g. Aspirin, Warfarin, Clopidogrel, Apixaban)?',
        category: 'MEDICATION_HISTORY',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, I take blood thinners', value: true },
            { label: 'No, I do not take blood thinners', value: false }
        ],
        helpText: 'Anticoagulants significantly increase bleeding and hemorrhage risks.',
        isRedFlagIndicator: true
    },
    KNOWN_CARDIAC_HISTORY: {
        questionId: 'KNOWN_CARDIAC_HISTORY',
        questionText: 'Do you have a prior history of heart attack, stents, bypass surgery, or angina?',
        category: 'CARDIOVASCULAR',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, prior heart condition', value: true },
            { label: 'No prior heart condition', value: false }
        ]
    },
    CALF_PAIN_UNILATERAL: {
        questionId: 'CALF_PAIN_UNILATERAL',
        questionText: 'Do you have painful swelling, redness, or tenderness in one of your calves/legs?',
        category: 'RESPIRATORY',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, swelling/pain in one leg', value: true },
            { label: 'No swelling or leg tenderness', value: false }
        ],
        helpText: 'Unilateral calf swelling with chest symptoms flags potential Pulmonary Embolism.',
        isRedFlagIndicator: true
    },
    COUGH_WITH_BLOOD: {
        questionId: 'COUGH_WITH_BLOOD',
        questionText: 'Are you coughing up blood or pink frothy sputum (Hemoptysis)?',
        category: 'RESPIRATORY',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, coughing up blood', value: true },
            { label: 'No blood in cough', value: false }
        ],
        isRedFlagIndicator: true
    },
    FACIAL_ASYMMETRY_SPEECH: {
        questionId: 'FACIAL_ASYMMETRY_SPEECH',
        questionText: 'Have you noticed any new facial drooping, arm weakness, or difficulty speaking/finding words?',
        category: 'NEUROLOGICAL',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, new weakness or speech difficulty', value: true },
            { label: 'No weakness or speech issues', value: false }
        ],
        helpText: 'FAST protocol screening for acute cerebral ischemia.',
        isRedFlagIndicator: true
    },
    SUDDEN_VISION_LOSS: {
        questionId: 'SUDDEN_VISION_LOSS',
        questionText: 'Did you experience any sudden loss of vision, double vision, or visual field darkening?',
        category: 'NEUROLOGICAL',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, sudden vision changes', value: true },
            { label: 'No vision changes', value: false }
        ],
        isRedFlagIndicator: true
    },
    NECK_STIFFNESS_FEVER: {
        questionId: 'NECK_STIFFNESS_FEVER',
        questionText: 'Do you have a stiff neck (inability to touch chin to chest) accompanied by fever or sensitivity to light?',
        category: 'NEUROLOGICAL',
        questionType: 'BOOLEAN',
        options: [
            { label: 'Yes, stiff neck with fever/light sensitivity', value: true },
            { label: 'No neck stiffness', value: false }
        ],
        helpText: 'Screening for acute meningeal irritation.',
        isRedFlagIndicator: true
    }
};
/**
 * Routes a reported symptom to an integrated, prioritized list of DynamicQuestion items.
 */
export function routeSymptomToQuestionSet(symptomName, site) {
    const normSymptom = symptomName.toUpperCase();
    const normSite = site?.toUpperCase();
    const domainQuestions = [];
    if (normSymptom.includes('CHEST') || normSite === 'CHEST' || normSymptom.includes('ANGINA') || normSymptom.includes('HEART')) {
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.MED_ON_BLOOD_THINNERS);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.KNOWN_CARDIAC_HISTORY);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.CALF_PAIN_UNILATERAL);
    }
    else if (normSymptom.includes('BREATH') || normSymptom.includes('DYSPNEA') || normSymptom.includes('COUGH') || normSymptom.includes('ASTHMA')) {
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.COUGH_WITH_BLOOD);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.CALF_PAIN_UNILATERAL);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.MED_ON_BLOOD_THINNERS);
    }
    else if (normSymptom.includes('HEAD') || normSite === 'HEAD' || normSymptom.includes('DIZZY') || normSymptom.includes('CONFUSION')) {
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.MED_ON_BLOOD_THINNERS);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.FACIAL_ASYMMETRY_SPEECH);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.SUDDEN_VISION_LOSS);
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.NECK_STIFFNESS_FEVER);
    }
    else {
        domainQuestions.push(DOMAIN_SCREENING_QUESTIONS.MED_ON_BLOOD_THINNERS);
    }
    const socratesQuestions = getSocratesQuestionSequence(symptomName, site);
    const seenIds = new Set();
    const combined = [];
    for (const q of [...socratesQuestions, ...domainQuestions]) {
        if (!seenIds.has(q.questionId)) {
            seenIds.add(q.questionId);
            combined.push(q);
        }
    }
    return combined;
}
