import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import localize from '../localize.js';
import { beyondConsequenceDamage, hpOf, manaOf, tempHpOf, woundsOf } from './resourceCost.js';

const KEY = 'NIMBLE.resourceCosts.beyond';

/** "You have 1 mana. Stretch Time needs 2." */
function shortLine(actor: CostPayer, cost: ResourceCost): string {
	const words = { source: cost.source ?? '', amount: String(cost.amount) };
	switch (cost.kind) {
		case 'mana':
			return localize(`${KEY}.mana`, { ...words, available: String(manaOf(actor)) });
		case 'tempHp':
			return localize(`${KEY}.tempHp`, { ...words, available: String(tempHpOf(actor)) });
		case 'hp':
			return localize(`${KEY}.hp`, { ...words, available: String(hpOf(actor)) });
		case 'wounds': {
			const wounds = woundsOf(actor);
			const room = Math.max(0, (wounds?.max ?? 0) - (wounds?.value ?? 0));
			return localize(`${KEY}.wounds`, {
				...words,
				available: String(room),
				wounds: localize(`NIMBLE.resourceCosts.${room === 1 ? 'woundWord' : 'woundsWord'}`),
			});
		}
	}
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
