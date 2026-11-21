import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import localize from '../localize.js';
import { beyondConsequenceDamage, resourceKind } from './resourceCost.js';
import { woundsWord } from './resourceCostWords.js';

const KEY = 'NIMBLE.resourceCosts.beyond';

/** "You have 1 mana. <source> needs 2." */
function shortLine(actor: CostPayer, cost: ResourceCost): string {
	const available = resourceKind(cost.kind).have(actor);
	return localize(`${KEY}.${cost.kind}`, {
		source: cost.source ?? '',
		amount: String(cost.amount),
		available: String(available),
		wounds: woundsWord(available),
	});
}

/**
 * Ask the player to confirm a use whose costs need more than the creature has. Resolves true
 * when the player confirms.
 */
export default async function confirmUsingBeyond(
	actor: CostPayer,
	costs: readonly ResourceCost[],
): Promise<boolean> {
	const paragraphs = costs.map((cost) => shortLine(actor, cost));
	for (const cost of costs) {
		const damage = beyondConsequenceDamage(actor, cost);
		if (damage > 0) {
			paragraphs.push(localize(`${KEY}.halfMaxHpDamage`, { damage: String(damage) }));
		}
	}
	paragraphs.push(localize(`${KEY}.question`));

	const confirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: localize(`${KEY}.title`) },
		content: paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join(''),
		yes: { label: localize(`${KEY}.confirm`) },
		no: { label: localize(`${KEY}.cancel`) },
		rejectClose: false,
	});
	return confirmed === true;
}
