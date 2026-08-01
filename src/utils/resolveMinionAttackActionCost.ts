import resolveItemActionCost, { type ItemWithActivationCost } from './resolveItemActionCost.js';

/**
 * Resolves the action cost a group-attack activation charges a combatant.
 *
 * Only an explicit `action` cost is honoured as written, including an
 * explicit zero, which stays genuinely free (a missing quantity defaults to
 * one). Every other activation cost, whether missing, `none`, or any
 * non-action type, charges the standard single action, because legacy pack
 * content routinely ships attack actions with such costs while still
 * representing a standard attack that spends one action.
 */
export default function resolveMinionAttackActionCost(item: ItemWithActivationCost | null): number {
	const cost = item?.system?.activation?.cost;
	if (cost?.type !== 'action') return 1;
	return resolveItemActionCost(item);
}
