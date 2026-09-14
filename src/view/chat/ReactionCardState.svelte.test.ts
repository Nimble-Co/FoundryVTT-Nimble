import { describe, expect, it } from 'vitest';
import { createReactionCardState } from './ReactionCardState.svelte.js';

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

function createMessageDocument(reactionType: string, speakerActor: unknown) {
	return {
		reactive: {
			system: {
				reactionType,
				armorValue: null,
				weaponName: null,
				weaponDamage: null,
				actorName: 'Shield Bearer',
			},
			author: { color: '#336699' },
		},
		speakerActor,
	};
}

function createState(reactionType: string, speakerActor: unknown) {
	return createReactionCardState(() => createMessageDocument(reactionType, speakerActor) as never);
}

const freeLabel = () => game.i18n.localize('NIMBLE.activationCosts.free');
const oneActionLabel = () => `1 ${game.i18n.localize('NIMBLE.activationCosts.action')}`;

describe('createReactionCardState costLabel', () => {
	it('prices the opportunity card by the opportunityAttack reaction', () => {
		const rules = [reactionCostRule('opportunityAttack', 0)];
		const state = createState('opportunity', { rules, reactive: { rules } });

		expect(state.costLabel).toBe(freeLabel());
	});

	it('leaves the other reactions at the base cost when only one is repriced', () => {
		const rules = [reactionCostRule('opportunityAttack', 0)];
		const state = createState('defend', { rules, reactive: { rules } });

		expect(state.costLabel).toBe(oneActionLabel());
	});

	it("reads the speaker actor's reactive rules", () => {
		const state = createState('interpose', {
			rules: [],
			reactive: { rules: [reactionCostRule('interpose', 0)] },
		});

		expect(state.costLabel).toBe(freeLabel());
	});

	it('falls back to the base cost when the speaker actor is gone', () => {
		const state = createState('interpose', null);

		expect(state.costLabel).toBe(oneActionLabel());
	});

	it('falls back to the static label for a card type that is not a heroic reaction', () => {
		const state = createState('custom', { rules: [], reactive: { rules: [] } });

		expect(state.costLabel).toBe(game.i18n.localize('NIMBLE.ui.heroicActions.reactions.cost'));
	});
});
