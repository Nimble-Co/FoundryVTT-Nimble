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
});
