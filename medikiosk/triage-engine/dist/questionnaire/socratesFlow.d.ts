import { DynamicQuestion } from '../events/socketEvents.js';
/**
 * SOCRATES Dynamic Questionnaire Flow
 *
 * Implements the clinical SOCRATES assessment framework with dynamic branching:
 * - Omits radiation questions when pain is localized to isolated digits/extremities.
 * - Prioritizes autonomic red-flag questions for torso/head presentations.
 */
export declare const SOCRATES_QUESTION_DEFINITIONS: {
    SITE: (defaultSite?: string) => DynamicQuestion;
    ONSET: () => DynamicQuestion;
    CHARACTER: () => DynamicQuestion;
    RADIATION: (site?: string) => DynamicQuestion;
    ASSOCIATED_SYMPTOMS: (site?: string) => DynamicQuestion;
    TIMING: () => DynamicQuestion;
    EXACERBATING_FACTORS: () => DynamicQuestion;
    SEVERITY: () => DynamicQuestion;
};
/**
 * Returns an ordered SOCRATES question sequence adapted to the symptom and anatomical site.
 */
export declare function getSocratesQuestionSequence(symptomName: string, site?: string): DynamicQuestion[];
