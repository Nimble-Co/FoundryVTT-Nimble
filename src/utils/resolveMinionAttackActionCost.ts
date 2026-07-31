import resolveItemActionCost, { type ItemWithActivationCost } from './resolveItemActionCost.js';

/**
 * Resolves the action cost a group-attack activation charges a combatant.
 *
 * Legacy pack content routinely ships attack actions with no activation cost
 * or a cost of type `none` while still representing a standard attack that
 * spends one action, so those default to a cost of one. An explicitly
 * authored action cost is honoured as written, including an explicit zero,
 * which stays genuinely free.
 */
export default function resolveMinionAttackActionCost(item: ItemWithActivationCost | null): number {
	const cost = item?.system?.activation?.cost;
	if (!cost?.type || cost.type === 'none') return 1;
	return resolveItemActionCost(item);
}
