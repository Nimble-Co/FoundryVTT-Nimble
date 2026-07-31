import type { ActionCostRule } from '../../models/rules/actionCost.js';
import resolveItemActionCost from '../../utils/resolveItemActionCost.js';

interface ActorWithRules {
	rules?: unknown[];
}

export interface ActivatableItem {
	type?: string;
	system?: {
		identifier?: string;
		activation?: {
			cost?: { type?: string; quantity?: number };
		};
	};
}

/**
 * Resolves the action cost of activating `item` on `actor`, folding the actor's
 * `actionCost` rules over the item's base cost. Matching rules apply in `priority`
 * order: `delta` adds its value, `set` overwrites the running cost. The result is
 * clamped at 0.
 *
 * Only activations whose cost type is `action` are priced — rules never charge
 * actions for activations measured in other units (minutes, none, etc.).
 */
export default function resolveCharacterItemActionCost(
	actor: ActorWithRules | null | undefined,
	item: ActivatableItem | null,
): number {
	const baseCost = resolveItemActionCost(item);
	if (item?.system?.activation?.cost?.type !== 'action') return baseCost;

	const rules = (actor?.rules ?? []) as ActionCostRule[];
	const matching = rules
		.filter((rule) => rule.type === 'actionCost' && rule.appliesTo() && rule.matchesItem(item))
		.sort((a, b) => a.priority - b.priority);

	let cost = baseCost;
	for (const rule of matching) {
		const value = rule.resolveValue();
		if (value === null) continue;
		cost = rule.mode === 'set' ? value : cost + value;
	}

	return Math.max(0, cost);
}
