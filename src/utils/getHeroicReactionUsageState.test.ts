import { beforeEach, describe, expect, it } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../tests/fixtures/combat.js';
import { createMockCombatant, getTestGlobals } from '../../tests/mocks/combat.js';
import { getHeroicReactionUsageState } from './getHeroicReactionUsageState.js';

type HeroicReactionUsageStateTestGlobals = {
	game: {
		user: {
			isGM: boolean;
		};
	};
};

function globals() {
	return getTestGlobals<HeroicReactionUsageStateTestGlobals>();
}

/**
 * Attaches a minimal reaction-scoped `actionCost` rule to the actor, exposing
 * only the surface `resolveHeroicReactionActionCost` reads.
 */
function addReactionActionCostRule(
	actor: object,
	config: { mode: 'delta' | 'set'; value: number; reactions?: string[] },
): void {
	const rule = {
		type: 'actionCost',
		priority: 1,
		mode: config.mode,
		appliesTo: () => true,
		matchesReaction: (reactionKey: string) =>
			(config.reactions ?? []).length === 0 || (config.reactions ?? []).includes(reactionKey),
		resolveValue: () => config.value,
	};
	(actor as { rules?: unknown[] }).rules = [
		...((actor as { rules?: unknown[] }).rules ?? []),
		rule,
	];
}

describe('getHeroicReactionUsageState', () => {
	beforeEach(() => {
		globals().game.user = { isGM: false };
	});

	it('allows an owner to use an available heroic reaction off-turn in started combat', () => {
		const actor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		});
		const combatant = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			actionsCurrent: 2,
			actionsMax: 3,
			actor,
			combatId: 'combat-heroic-usage',
		});
		const activeCombatant = createMockCombatant({
			id: 'active-character',
			type: 'character',
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId: 'combat-heroic-usage',
		});
		const combat = {
			round: 1,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture([activeCombatant, combatant]),
		} as unknown as Combat;

		const usageState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['defend'],
		});

		expect(usageState.canUse).toBe(true);
		expect(usageState.blockedReason).toBeNull();
		expect(usageState.currentActions).toBe(2);
		expect(usageState.requiredActions).toBe(1);
	});

	it('blocks heroic reaction use outside started combat', () => {
		const combatant = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			actionsCurrent: 2,
			actionsMax: 3,
			actor: createCombatActorFixture({
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
				isOwner: true,
			}),
		});
		const combat = {
			round: 0,
			combatant: null,
			combatants: createCombatantsCollectionFixture([combatant]),
		} as unknown as Combat;

		const usageState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['help'],
		});

		expect(usageState.canUse).toBe(false);
		expect(usageState.blockedReason).toBe('outsideCombat');
	});

	it('blocks combined heroic reaction use when one reaction is already spent', () => {
		const combatant = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
				isOwner: true,
			}),
		});
		foundry.utils.setProperty(combatant, 'system.actions.heroic.interposeAvailable', false);

		const combat = {
			round: 1,
			combatant: createMockCombatant({
				id: 'active-character',
				type: 'character',
				actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			}),
			combatants: createCombatantsCollectionFixture([combatant]),
		} as unknown as Combat;

		const usageState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['interpose', 'defend'],
		});

		expect(usageState.canUse).toBe(false);
		expect(usageState.blockedReason).toBe('spent');
		expect(usageState.requiredActions).toBe(2);
	});

	it('reflects actor actionCost rules in the required actions', () => {
		const actor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		});
		addReactionActionCostRule(actor, { mode: 'set', value: 0, reactions: ['defend'] });
		const combatant = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			actionsCurrent: 0,
			actionsMax: 3,
			actor,
			combatId: 'combat-heroic-cost',
		});
		const activeCombatant = createMockCombatant({
			id: 'active-character',
			type: 'character',
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId: 'combat-heroic-cost',
		});
		const combat = {
			round: 1,
			combatant: activeCombatant,
			combatants: createCombatantsCollectionFixture([activeCombatant, combatant]),
		} as unknown as Combat;

		// A free Defend is usable with 0 actions remaining...
		const defendState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['defend'],
		});
		expect(defendState.requiredActions).toBe(0);
		expect(defendState.canUse).toBe(true);

		// ...but the discount is scoped: other reactions still cost 1.
		const helpState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['help'],
		});
		expect(helpState.requiredActions).toBe(1);
		expect(helpState.blockedReason).toBe('noActions');
	});

	it('still blocks a free reaction that was already used this round', () => {
		const actor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		});
		addReactionActionCostRule(actor, { mode: 'set', value: 0 });
		const combatant = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			actionsCurrent: 3,
			actionsMax: 3,
			actor,
			combatId: 'combat-heroic-cost-limit',
		});
		foundry.utils.setProperty(combatant, 'system.actions.heroic.defendAvailable', false);
		const combat = {
			round: 1,
			combatant: createMockCombatant({
				id: 'active-character',
				type: 'character',
				actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			}),
			combatants: createCombatantsCollectionFixture([combatant]),
		} as unknown as Combat;

		const usageState = getHeroicReactionUsageState({
			combat,
			combatant,
			reactionKeys: ['defend'],
		});

		// Cost and use-limit are orthogonal: a free reaction is still 1/round.
		expect(usageState.requiredActions).toBe(0);
		expect(usageState.canUse).toBe(false);
		expect(usageState.blockedReason).toBe('spent');
	});
});
