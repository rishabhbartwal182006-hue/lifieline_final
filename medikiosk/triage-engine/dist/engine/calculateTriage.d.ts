import { TriggeredRule } from '../rules/types.js';
import { TriageResult } from '../schemas/triageResult.js';
import { SessionState } from './sessionState.js';
/**
 * Triage Calculation Layer
 *
 * Escalation Hierarchy:
 * 1. If ANY rule is 'EMERGENCY' -> Final Level = EMERGENCY
 * 2. Else if ANY rule is 'URGENT' -> Final Level = URGENT
 * 3. Else -> Final Level = ROUTINE
 */
export declare function calculateTriage(sessionId: string, triggeredRules: TriggeredRule[], sessionState?: SessionState): TriageResult;
