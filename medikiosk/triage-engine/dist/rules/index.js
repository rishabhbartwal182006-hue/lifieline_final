import { CARDIAC_RULES } from './cardiac/index.js';
import { RESPIRATORY_RULES } from './respiratory/index.js';
import { NEUROLOGICAL_RULES } from './neurological/index.js';
import { VITALS_RULES } from './vitals/index.js';
import { GENERAL_RULES } from './general/index.js';
export * from './types.js';
export * from './cardiac/index.js';
export * from './respiratory/index.js';
export * from './neurological/index.js';
export * from './vitals/index.js';
export * from './general/index.js';
/**
 * Master Registry of all active clinical triage rules.
 */
export const ALL_RULES = [
    ...CARDIAC_RULES,
    ...RESPIRATORY_RULES,
    ...NEUROLOGICAL_RULES,
    ...VITALS_RULES,
    ...GENERAL_RULES
];
export function getRuleById(id) {
    return ALL_RULES.find((r) => r.id === id);
}
export function getRulesByCategory(category) {
    return ALL_RULES.filter((r) => r.category === category);
}
