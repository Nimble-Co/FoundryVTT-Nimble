import { activationCost, enabledRules } from './itemFields.ts';
import type { ItemLike } from './sheetSource.ts';

/** Where a feature shows: on Actions, in Reactions, or only on Features (passive). */
export type ItemPlace = 'action' | 'reaction' | 'passive';

const ACT_RULES = new Set(['chargeConsumer', 'toggleEffect', 'markTarget']);

/**
 * A reaction cost puts the item in Reactions. An action cost, a consumer that you spend
 * by hand, or a rule that you turn on or aim puts it on Actions. All else is passive.
 */
export function placeOf(item: ItemLike): ItemPlace {
	const cost = activationCost(item);
	if (cost.isReaction || cost.type === 'reaction') return 'reaction';
	if (cost.type === 'action') return 'action';
	const acts = enabledRules(item).some(
		(rule) =>
			ACT_RULES.has(rule.type) ||
			(rule.type === 'diceConsumer' && (rule.fields.mode ?? 'manual') === 'manual'),
	);
	return acts ? 'action' : 'passive';
}
