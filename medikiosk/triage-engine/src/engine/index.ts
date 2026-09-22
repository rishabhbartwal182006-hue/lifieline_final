import { validatePatientEvent, ValidationErrorDetail } from '../schemas/patientEvent.js';
import { TriageResult } from '../schemas/triageResult.js';
import { applyEventToSession, SessionState, updateSessionTriage } from './sessionState.js';
import { evaluateAllRules } from './evaluateRules.js';
import { calculateTriage } from './calculateTriage.js';
import { ALL_RULES } from '../rules/index.js';
import { evaluateAltitudeRules } from '../rules/environment/altitudeRules.js';

export * from './sessionState.js';
export * from './evaluateRules.js';
export * from './calculateTriage.js';

export class EventValidationError extends Error {
  public readonly errors: ValidationErrorDetail[];
  public readonly rawEventType?: string;

  constructor(message: string, errors: ValidationErrorDetail[], rawEventType?: string) {
    super(message);
    this.name = 'EventValidationError';
    this.errors = errors;
    this.rawEventType = rawEventType;
  }
}

export type ProcessEventSafeResult =
  | { success: true; result: TriageResult; session: SessionState; triggeredRuleCount: number }
  | { success: false; error: string; errors: ValidationErrorDetail[]; rawEventType?: string };

/**
 * Primary Engine Function: processPatientEvent
 * 
 * Executes full evaluation cycle on an incoming raw event:
 * 1. Validates schema and physical plausibility bounds
 * 2. Updates accumulated in-memory session state
 * 3. Evaluates all registered clinical rules against full session context
 * 4. Determines final TriageResult (EMERGENCY / URGENT / ROUTINE)
 */
export function processPatientEvent(rawEvent: unknown): TriageResult {
  const validation = validatePatientEvent(rawEvent);
  if (!validation.success) {
    throw new EventValidationError(validation.error, validation.errors, validation.rawEventType);
  }

  const validEvent = validation.data;
  const updatedSession = applyEventToSession(validEvent);
  const triggeredRules = [...evaluateAllRules(updatedSession, ALL_RULES), ...evaluateAltitudeRules(updatedSession.vitals, undefined, updatedSession.symptoms.list)];
  const triageResult = calculateTriage(validEvent.sessionId, triggeredRules, updatedSession);

  updateSessionTriage(validEvent.sessionId, triageResult);
  return triageResult;
}

/**
 * Safe wrapper for processPatientEvent that catches validation and evaluation errors.
 */
export function processPatientEventSafe(rawEvent: unknown): ProcessEventSafeResult {
  try {
    const validation = validatePatientEvent(rawEvent);
    if (!validation.success) {
      return {
        success: false,
        error: validation.error,
        errors: validation.errors,
        rawEventType: validation.rawEventType
      };
    }

    const validEvent = validation.data;
    const session = applyEventToSession(validEvent);
    const triggeredRules = [...evaluateAllRules(session, ALL_RULES), ...evaluateAltitudeRules(session.vitals, undefined, session.symptoms.list)];
    const result = calculateTriage(validEvent.sessionId, triggeredRules, session);

    updateSessionTriage(validEvent.sessionId, result);

    return {
      success: true,
      result,
      session,
      triggeredRuleCount: triggeredRules.length
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Unknown processing error',
      errors: []
    };
  }
}
