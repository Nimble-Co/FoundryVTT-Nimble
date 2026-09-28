import type { ConditionScope } from '../config/registerConditionsConfig.js';

/**
 * Whether a condition is inflicted by a monster feature rather than handed out by a GM.
 *
 * Monster-scoped conditions carry mechanics that only make sense alongside the feature that
 * applied them, so they are hidden from the pickers that offer every condition. They still render
 * normally once active, and nothing stops a rule or a macro from applying one.
 */
export default function isMonsterScopedCondition(conditionId: string): boolean {
	const scopes = (CONFIG.NIMBLE as { conditionScopes?: Record<string, ConditionScope> })
		.conditionScopes;
	return scopes?.[conditionId] === 'monster';
}
