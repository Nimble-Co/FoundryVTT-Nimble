import isMonsterScopedCondition from './isMonsterScopedCondition.js';

/**
 * Whether a condition belongs in a picker a GM chooses from.
 *
 * Monster-scoped conditions are inflicted by a monster's feature rather than handed out, so they
 * stay out of the pickers until the creature already carries one, at which point it has to be
 * visible and clearable. They remain registered in `CONFIG.statusEffects` either way, because that
 * is the list Foundry validates a status id against before it will build the effect.
 */
export default function shouldListCondition(
	conditionId: string,
	activeConditionIds: ReadonlySet<string> = new Set(),
): boolean {
	return !isMonsterScopedCondition(conditionId) || activeConditionIds.has(conditionId);
}
