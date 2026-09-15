import formatActivationCostLabel from './formatActivationCostLabel.js';
import type { HeroicReactionKey } from './heroicActions.js';
import resolveHeroicReactionActionCost from './resolveHeroicReactionActionCost.js';

export type HeroicReactionCostActor = Parameters<typeof resolveHeroicReactionActionCost>[0];

/**
 * The cost label for using the given heroic reactions together, resolved from
 * the actor's `actionCost` rules so a repriced reaction never advertises a cost
 * the actor does not pay. Uses the activation cost wording ("Free", "1 Action",
 * "2 Actions") so it reads like every other cost printed on the sheet.
 */
export default function getHeroicReactionCostLabel(
	actor: HeroicReactionCostActor,
	reactionKeys: HeroicReactionKey[],
): string {
	const cost = resolveHeroicReactionActionCost(actor, reactionKeys);

	return formatActivationCostLabel({ type: 'action', quantity: cost }) ?? '';
}
