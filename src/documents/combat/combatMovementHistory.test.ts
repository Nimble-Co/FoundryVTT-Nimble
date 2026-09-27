import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../../tests/fixtures/combat.js';
import {
	createMockCombatant,
	getTestGlobals,
	type NimbleCombatDocumentTestGlobals,
} from '../../../tests/mocks/combat.js';
import { AUTOMATION_SETTING_KEYS } from '../../settings/automationSettings.js';
import { NimbleCombat } from './combat.svelte.js';

type TestGlobals = NimbleCombatDocumentTestGlobals & {
	game: { settings?: { get: ReturnType<typeof vi.fn> } };
};

type MovementHistoryCombat = NimbleCombat & {
	clearMovementHistories: ReturnType<typeof vi.fn>;
	_clearMovementHistoryOnStartTurn: (
		combatant: Combatant.Implementation,
		context: Combat.TurnEventContext,
	) => Promise<void>;
};

function globals() {
	return getTestGlobals<TestGlobals>();
}

function setMovementTracking(enabled: boolean) {
	globals().game.settings = {
		get: vi.fn((_namespace: string, key: string) =>
			key === AUTOMATION_SETTING_KEYS.movementTracking ? enabled : undefined,
		),
	};
}

function turnContext(skipped: boolean): Combat.TurnEventContext {
	return { round: 1, turn: 0, skipped } as Combat.TurnEventContext;
}

function createHero(id: string, combatId: string, sort = 1) {
	return createMockCombatant({
		id,
		type: 'character',
		sort,
		isOwner: true,
		initiative: 10,
		actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
		combatId,
	});
}

function createMinion(id: string, combatId: string, groupId: string, role: 'leader' | 'member') {
	const minion = createMockCombatant({
		id,
		type: 'npc',
		sort: role === 'leader' ? 1 : 2,
		isOwner: false,
		initiative: 12,
		actor: {
			...createCombatActorFixture({ id: `${id}-actor`, hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation,
		combatId,
	});
	(minion as unknown as { flags: Record<string, unknown> }).flags = {
		nimble: { minionGroup: { id: groupId, role } },
	};
	return minion;
}

function buildCombat(combatId: string, combatants: Combatant.Implementation[]) {
	const combat = new NimbleCombat({
		id: combatId,
		combatants: createCombatantsCollectionFixture(combatants),
		turns: combatants,
		turn: 0,
		combatant: combatants[0],
	} as unknown as Combat.CreateData) as MovementHistoryCombat;
	combat.clearMovementHistories = vi.fn().mockResolvedValue(undefined);
	return combat;
}

function clearedIds(combat: MovementHistoryCombat): string[][] {
	return combat.clearMovementHistories.mock.calls.map(([combatants]) =>
		Array.from(combatants as Iterable<Combatant.Implementation>, (c) => c.id ?? ''),
	);
}

describe('NimbleCombat movement history clearing', () => {
	let superClear: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.clearAllMocks();
		globals().game.user = { isGM: true, role: 4 };
		setMovementTracking(true);

		superClear = vi.fn(async () => undefined);
		const combatPrototype = globals().Combat.prototype;
		combatPrototype._clearMovementHistoryOnStartTurn = superClear;
	});

	describe('turn start', () => {
		it('clears only the incoming combatant', async () => {
			const combatId = 'combat-clear-incoming';
			const hero = createHero('hero', combatId);
			const other = createHero('other', combatId, 2);
			const combat = buildCombat(combatId, [hero, other]);

			await combat._clearMovementHistoryOnStartTurn(hero, turnContext(false));

			expect(clearedIds(combat)).toEqual([['hero']]);
			expect(superClear).not.toHaveBeenCalled();
		});

		it('clears nothing for a skipped turn', async () => {
			const combatId = 'combat-clear-skipped';
			const hero = createHero('hero', combatId);
			const combat = buildCombat(combatId, [hero]);

			await combat._clearMovementHistoryOnStartTurn(hero, turnContext(true));

			expect(combat.clearMovementHistories).not.toHaveBeenCalled();
			expect(superClear).not.toHaveBeenCalled();
		});

		it('clears every member of the minion group when the group leader starts its turn', async () => {
			const combatId = 'combat-clear-minion-group';
			const leader = createMinion('minion-leader', combatId, 'group-1', 'leader');
			const member = createMinion('minion-member', combatId, 'group-1', 'member');
			const otherGroupMember = createMinion('other-member', combatId, 'group-2', 'member');
			const hero = createHero('hero', combatId, 3);
			const combat = buildCombat(combatId, [leader, member, otherGroupMember, hero]);

			await combat._clearMovementHistoryOnStartTurn(leader, turnContext(false));

			expect(clearedIds(combat)).toEqual([['minion-leader', 'minion-member']]);
		});

		it('defers to core when movement tracking is off, skipped or not', async () => {
			setMovementTracking(false);
			const combatId = 'combat-clear-toggle-off';
			const hero = createHero('hero', combatId);
			const combat = buildCombat(combatId, [hero]);

			await combat._clearMovementHistoryOnStartTurn(hero, turnContext(false));
			await combat._clearMovementHistoryOnStartTurn(hero, turnContext(true));

			expect(superClear).toHaveBeenCalledTimes(2);
			expect(combat.clearMovementHistories).not.toHaveBeenCalled();
		});
	});
});
