import { ALL_RULES } from '../rules/index.js';
/**
 * Safely resolves a nested dot-notated path from an object.
 */
export function getNestedValue(obj, path) {
    if (obj === null || obj === undefined)
        return undefined;
    const segments = path.split('.');
    let current = obj;
    for (const segment of segments) {
        if (current === null || current === undefined) {
            return undefined;
        }
        current = current[segment];
    }
    return current;
}
/**
 * Normalizes values for comparison (uppercases strings, trims whitespace).
 */
function normalizeForComparison(val) {
    if (typeof val === 'string') {
        return val.trim().toUpperCase();
    }
    return val;
}
/**
 * Evaluates a single Condition against the SessionState
 */
export function evaluateCondition(condition, state) {
    const actualValue = getNestedValue(state, condition.field);
    const targetValue = condition.value;
    if (actualValue === undefined || actualValue === null) {
        if (condition.operator === 'notEquals')
            return { matched: true, actualValue };
        if (condition.operator === 'exists')
            return { matched: false, actualValue };
        return { matched: false, actualValue };
    }
    switch (condition.operator) {
        case 'equals': {
            const normActual = normalizeForComparison(actualValue);
            const normTarget = normalizeForComparison(targetValue);
            return { matched: normActual === normTarget, actualValue };
        }
        case 'notEquals': {
            const normActual = normalizeForComparison(actualValue);
            const normTarget = normalizeForComparison(targetValue);
            return { matched: normActual !== normTarget, actualValue };
        }
        case 'greaterThan': {
            const numActual = Number(actualValue);
            const numTarget = Number(targetValue);
            return { matched: !isNaN(numActual) && !isNaN(numTarget) && numActual > numTarget, actualValue };
        }
        case 'greaterThanOrEqual': {
            const numActual = Number(actualValue);
            const numTarget = Number(targetValue);
            return { matched: !isNaN(numActual) && !isNaN(numTarget) && numActual >= numTarget, actualValue };
        }
        case 'lessThan': {
            const numActual = Number(actualValue);
            const numTarget = Number(targetValue);
            return { matched: !isNaN(numActual) && !isNaN(numTarget) && numActual < numTarget, actualValue };
        }
        case 'lessThanOrEqual': {
            const numActual = Number(actualValue);
            const numTarget = Number(targetValue);
            return { matched: !isNaN(numActual) && !isNaN(numTarget) && numActual <= numTarget, actualValue };
        }
        case 'includes': {
            if (Array.isArray(actualValue)) {
                const normTarget = normalizeForComparison(targetValue);
                const hasElement = actualValue.some((item) => normalizeForComparison(item) === normTarget);
                return { matched: hasElement, actualValue };
            }
            if (typeof actualValue === 'string') {
                const normActual = String(actualValue).toUpperCase();
                const normTarget = String(targetValue).toUpperCase();
                return { matched: normActual.includes(normTarget), actualValue };
            }
            return { matched: false, actualValue };
        }
        case 'inArray': {
            if (Array.isArray(targetValue)) {
                const normActual = normalizeForComparison(actualValue);
                const inList = targetValue.some((item) => normalizeForComparison(item) === normActual);
                return { matched: inList, actualValue };
            }
            return { matched: false, actualValue };
        }
        case 'between': {
            if (Array.isArray(targetValue) && targetValue.length === 2) {
                const numActual = Number(actualValue);
                const [min, max] = targetValue.map(Number);
                return {
                    matched: !isNaN(numActual) && numActual >= min && numActual <= max,
                    actualValue
                };
            }
            return { matched: false, actualValue };
        }
        case 'exists': {
            return { matched: actualValue !== undefined && actualValue !== null, actualValue };
        }
        default:
            return { matched: false, actualValue };
    }
}
/**
 * Evaluates a single Rule against SessionState (AND logic across conditions).
 */
export function evaluateRule(rule, state) {
    const matchedConditions = [];
    for (const condition of rule.conditions) {
        const { matched, actualValue } = evaluateCondition(condition, state);
        if (!matched) {
            return null;
        }
        matchedConditions.push(`Condition [${condition.field} ${condition.operator} ${JSON.stringify(condition.value)}]: matched with actual value = ${JSON.stringify(actualValue)}`);
    }
    return {
        id: rule.id,
        name: rule.name,
        category: rule.category,
        priority: rule.priority,
        action: rule.action,
        reason: rule.reason,
        matchedConditions
    };
}
/**
 * Evaluates all registered rules against the current session state.
 */
export function evaluateAllRules(state, rules = ALL_RULES) {
    const triggered = [];
    for (const rule of rules) {
        const result = evaluateRule(rule, state);
        if (result) {
            triggered.push(result);
        }
    }
    return triggered;
}
