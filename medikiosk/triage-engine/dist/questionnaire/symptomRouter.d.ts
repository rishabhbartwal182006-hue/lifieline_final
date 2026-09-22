import { DynamicQuestion } from '../events/socketEvents.js';
/**
 * Symptom Question Router
 *
 * Maps presenting complaints to targeted clinical decision questions
 * and red-flag screening batteries.
 */
export declare const DOMAIN_SCREENING_QUESTIONS: Record<string, DynamicQuestion>;
/**
 * Routes a reported symptom to an integrated, prioritized list of DynamicQuestion items.
 */
export declare function routeSymptomToQuestionSet(symptomName: string, site?: string): DynamicQuestion[];
