import { ValidationErrorDetail } from '../schemas/patientEvent.js';
import { TriageResult } from '../schemas/triageResult.js';
import { SessionState } from './sessionState.js';
export * from './sessionState.js';
export * from './evaluateRules.js';
export * from './calculateTriage.js';
export declare class EventValidationError extends Error {
    readonly errors: ValidationErrorDetail[];
    readonly rawEventType?: string;
    constructor(message: string, errors: ValidationErrorDetail[], rawEventType?: string);
}
export type ProcessEventSafeResult = {
    success: true;
    result: TriageResult;
    session: SessionState;
    triggeredRuleCount: number;
} | {
    success: false;
    error: string;
    errors: ValidationErrorDetail[];
    rawEventType?: string;
};
/**
 * Primary Engine Function: processPatientEvent
 *
 * Executes full evaluation cycle on an incoming raw event:
 * 1. Validates schema and physical plausibility bounds
 * 2. Updates accumulated in-memory session state
 * 3. Evaluates all registered clinical rules against full session context
 * 4. Determines final TriageResult (EMERGENCY / URGENT / ROUTINE)
 */
export declare function processPatientEvent(rawEvent: unknown): TriageResult;
/**
 * Safe wrapper for processPatientEvent that catches validation and evaluation errors.
 */
export declare function processPatientEventSafe(rawEvent: unknown): ProcessEventSafeResult;
