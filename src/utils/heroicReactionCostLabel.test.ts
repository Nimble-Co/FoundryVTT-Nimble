import { describe, expect, it } from 'vitest';
import getHeroicReactionCostLabel from './heroicReactionCostLabel.js';

// Only the members resolveHeroicReactionActionCost reads from an actionCost rule.
function reactionCostRule(reactionKey: string, cost: number) {
	return {
		type: 'actionCost',
		mode: 'set',
		priority: 1,
		appliesTo: () => true,
		matchesReaction: (key: string) => key === reactionKey,
		resolveValue: () => cost,
	};
}

describe('getHeroicReactionCostLabel', () => {
	it('labels a free reaction with the activation cost wording', () => {
		const actor = { rules: [reactionCostRule('interpose', 0)] };

		expect(getHeroicReactionCostLabel(actor, ['interpose'])).toBe(
			game.i18n.localize('NIMBLE.activationCosts.free'),
		);
	});

	it('labels the default cost as one action', () => {
		expect(getHeroicReactionCostLabel(null, ['interpose'])).toBe(
			`1 ${game.i18n.localize('NIMBLE.activationCosts.action')}`,
		);
	});

	it('pluralises a combined cost', () => {
		expect(getHeroicReactionCostLabel({ rules: [] }, ['interpose', 'defend'])).toBe(
			`2 ${game.i18n.localize('NIMBLE.activationCostsPlural.action')}`,
		);
	});
});
