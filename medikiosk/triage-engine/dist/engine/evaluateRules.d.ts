import { SessionState } from './sessionState.js';
import { Rule, Condition, TriggeredRule } from '../rules/types.js';
/**
 * Safely resolves a nested dot-notated path from an object.
 */
export declare function getNestedValue(obj: unknown, path: string): unknown;
/**
 * Evaluates a single Condition against the SessionState
 */
export declare function evaluateCondition(condition: Condition, state: SessionState): {
    matched: boolean;
    actualValue: unknown;
};
/**
 * Evaluates a single Rule against SessionState (AND logic across conditions).
 */
export declare function evaluateRule(rule: Rule, state: SessionState): TriggeredRule | null;
/**
 * Evaluates all registered rules against the current session state.
 */
export declare function evaluateAllRules(state: SessionState, rules?: readonly Rule[]): TriggeredRule[];
