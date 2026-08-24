import localize from '../localize.js';
import type { ResolvedSpellCost } from './spellCost.js';

interface SpellOverdraftConfirmationOptions {
	spellName: string;
	cost: ResolvedSpellCost;
	available: number;
	damage: number;
}

/**
 * Asks the player to confirm a cast that exceeds their class spell pool, so
 * the consequence never lands by accident. Resolves true when the player
 * confirms the cast.
 */
export default async function confirmSpellOverdraft(
	options: SpellOverdraftConfirmationOptions,
): Promise<boolean> {
	const { spellName, cost, available, damage } = options;
	if (cost.type !== 'pool') return true;

	const confirmKey = 'NIMBLE.ui.confirmSpellOverdraft';

	const paragraphs = [
		localize(`${confirmKey}.message`, {
			available: String(available),
			required: String(cost.amount),
			pool: cost.poolLabel,
		}),
	];

	if (cost.overdraftConsequence === 'halfMaxHpDamage') {
		paragraphs.push(localize(`${confirmKey}.halfMaxHpDamage`, { damage: String(damage) }));
	}

	paragraphs.push(localize(`${confirmKey}.confirmQuestion`, { name: spellName }));

	const confirmed = await foundry.applications.api.DialogV2.confirm({
		window: { title: localize(`${confirmKey}.title`) },
		content: paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join(''),
		yes: { label: localize(`${confirmKey}.confirm`) },
		no: { label: localize(`${confirmKey}.cancel`) },
		rejectClose: false,
	});

	return confirmed === true;
}
