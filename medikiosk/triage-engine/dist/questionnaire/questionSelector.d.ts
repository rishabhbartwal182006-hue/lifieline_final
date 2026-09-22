import { SessionState } from '../engine/sessionState.js';
import { DynamicQuestion, NextQuestionPayload } from '../events/socketEvents.js';
/**
 * Dynamic Question Selector
 *
 * Analyzes session state, skips pre-populated or answered attributes,
 * and selects the next most pertinent clinical question.
 */
export declare function isQuestionAnswered(question: DynamicQuestion, session: SessionState): boolean;
export declare function getNextQuestion(sessionId: string): NextQuestionPayload;
export declare function shouldInterruptQuestionnaire(sessionId: string): {
    interrupted: boolean;
    reason?: string;
    triageLevel?: string;
    action?: string;
    triggeredRules?: string[];
};
