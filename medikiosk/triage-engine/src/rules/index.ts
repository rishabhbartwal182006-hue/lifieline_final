import { Rule } from './types.js';
import { CARDIAC_RULES } from './cardiac/index.js';
import { RESPIRATORY_RULES } from './respiratory/index.js';
import { NEUROLOGICAL_RULES } from './neurological/index.js';
import { VITALS_RULES } from './vitals/index.js';
import { GENERAL_RULES } from './general/index.js';
import { ENVIRONMENT_RULES } from './environment/altitudeRules.js';

export * from './types.js';
export * from './cardiac/index.js';
export * from './respiratory/index.js';
export * from './neurological/index.js';
export * from './vitals/index.js';
export * from './general/index.js';
export * from './environment/altitudeRules.js';

/**
 * Master Registry of all active clinical triage rules.
 */
export const ALL_RULES: readonly Rule[] = [
  ...CARDIAC_RULES,
  ...RESPIRATORY_RULES,
  ...NEUROLOGICAL_RULES,
  ...VITALS_RULES,
  ...GENERAL_RULES,
  ...ENVIRONMENT_RULES
];

export function getRuleById(id: string): Rule | undefined {
  return ALL_RULES.find((r) => r.id === id);
}

export function getRulesByCategory(category: Rule['category']): Rule[] {
  return ALL_RULES.filter((r) => r.category === category);
}
