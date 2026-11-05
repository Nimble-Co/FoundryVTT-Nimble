import type { ActionCostRule } from '../../models/rules/actionCost.js';
import { wearsArmorWithoutProficiency } from '../defend/armorProficiency.js';
import type { HeroicReactionKey } from './heroicActions.js';

interface ActorWithRules {
	rules?: unknown[];
}

type CostActor = ActorWithRules & Parameters<typeof wearsArmorWithoutProficiency>[0];

/**
 * Resolves the total action cost of using the given heroic reactions, folding
 * the actor's reaction-scoped `actionCost` rules over each reaction's base cost
 * of 1 action. Defend costs 1 more in armor worn without proficiency. Matching
 * rules apply per reaction in `priority` order: `delta`
 * adds its value, `set` overwrites the running cost. Each reaction's cost is
 * clamped at 0 before summing, so a discount on one reaction never subsidizes
 * another used alongside it.
 *
 * Cost is orthogonal to the once-per-round use limit — callers must keep
 * checking the `*Available` flags regardless of the resolved cost.
 *
 * The fold semantics intentionally mirror `resolveCharacterItemActionCost`
 * (second occurrence of the pattern — extract a shared fold helper only if a
 * third cost surface appears).
 */
export default function resolveHeroicReactionActionCost(
	actor: CostActor | null | undefined,
	reactionKeys: HeroicReactionKey[],
): number {
	const normalizedReactionKeys = Array.from(new Set(reactionKeys));

	const rules = (actor?.rules ?? []) as ActionCostRule[];
	const applicable = rules
		.filter((rule) => rule.type === 'actionCost' && rule.appliesTo())
		.sort((a, b) => a.priority - b.priority);

	const armorExtra = wearsArmorWithoutProficiency(actor) ? 1 : 0;
	let totalCost = 0;
	for (const reactionKey of normalizedReactionKeys) {
		let cost = reactionKey === 'defend' ? 1 + armorExtra : 1;
		for (const rule of applicable) {
			if (!rule.matchesReaction(reactionKey)) continue;
			const value = rule.resolveValue();
			if (value === null) continue;
			cost = rule.mode === 'set' ? value : cost + value;
		}
		totalCost += Math.max(0, cost);
	}

	return totalCost;
}
