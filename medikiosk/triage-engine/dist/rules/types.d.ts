/**
 * Clinical Rule Engine Data Models & Condition Types
 *
 * Declarative rule structure:
 * 1. Conditions (AND logic) evaluated against accumulated session state.
 * 2. Acuity priority (EMERGENCY vs URGENT).
 * 3. Human-readable explainable reason and recommended clinical action.
 */
export type RuleCategory = 'respiratory' | 'cardiac' | 'neurological' | 'vitals' | 'general';
export type RulePriority = 'EMERGENCY' | 'URGENT';
export type ConditionOperator = 'equals' | 'notEquals' | 'greaterThan' | 'greaterThanOrEqual' | 'lessThan' | 'lessThanOrEqual' | 'includes' | 'inArray' | 'exists' | 'between';
export interface Condition {
    /** Dot-notated path into accumulated session state (e.g. "symptoms.primary.site") */
    field: string;
    /** Comparison operator */
    operator: ConditionOperator;
    /** Value to compare against */
    value?: unknown;
}
export interface Rule {
    /** Unique rule identifier (e.g., "RULE_CARDIAC_ACS_RED_FLAG") */
    id: string;
    /** Human-readable rule title */
    name: string;
    /** Clinical domain category */
    category: RuleCategory;
    /** Triage escalation level */
    priority: RulePriority;
    /** Conditions that must all match (AND logic) */
    conditions: Condition[];
    /** Recommended operational action */
    action: string;
    /** Explainable clinical rationale */
    reason: string;
    /** Metadata and source guideline reference */
    metadata?: {
        guidelineSource?: string;
        isDemoPlaceholder?: boolean;
    };
}
export interface TriggeredRule {
    id: string;
    name: string;
    category: RuleCategory;
    priority: RulePriority;
    action: string;
    reason: string;
    matchedConditions: string[];
}
