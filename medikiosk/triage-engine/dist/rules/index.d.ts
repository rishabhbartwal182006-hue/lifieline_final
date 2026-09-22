import { Rule } from './types.js';
export * from './types.js';
export * from './cardiac/index.js';
export * from './respiratory/index.js';
export * from './neurological/index.js';
export * from './vitals/index.js';
export * from './general/index.js';
/**
 * Master Registry of all active clinical triage rules.
 */
export declare const ALL_RULES: readonly Rule[];
export declare function getRuleById(id: string): Rule | undefined;
export declare function getRulesByCategory(category: Rule['category']): Rule[];
