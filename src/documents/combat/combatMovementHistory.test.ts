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
	update: ReturnType<typeof vi.fn>;
	updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
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
	combat.update = vi.fn().mockResolvedValue(combat);
	combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
	return combat;
}

type AdvanceTarget = Combat & { turn?: number; combatant?: Combatant.Implementation | null };

/** Core advances the turn but, as under a turn-event skip, never starts the incoming turn. */
function advanceWithoutTurnEvents(
	method: 'nextTurn' | 'nextRound',
	incoming: Combatant.Implementation,
) {
	const superAdvance = globals().Combat.prototype[method] as ReturnType<typeof vi.fn>;
	superAdvance.mockImplementation(async function (this: AdvanceTarget) {
		this.turn = (this.turns ?? []).indexOf(incoming);
		this.combatant = incoming;
		return this;
	});
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
		combatPrototype._onEndTurn = vi.fn(async () => undefined);
		combatPrototype._onStartTurn = vi.fn(async () => undefined);
		combatPrototype.setupTurns = vi.fn(function (this: {
			combatants?: { contents?: Combatant.Implementation[] };
		}) {
			return this.combatants?.contents ?? [];
		});
		combatPrototype.nextTurn = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype.nextRound = vi.fn(async function (this: Combat) {
			return this;
		});
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

	describe('turn-event skip backstop', () => {
		beforeEach(() => {
			globals().game.user = {
				isGM: true,
				role: 4,
				isActiveGM: true,
			} as TestGlobals['game']['user'];
		});

		it('clears the incoming combatant when core never starts the turn on nextTurn', async () => {
			const combatId = 'combat-backstop-next-turn';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			advanceWithoutTurnEvents('nextTurn', incoming);

			await combat.nextTurn();

			expect(clearedIds(combat)).toEqual([['incoming']]);
		});

		it('clears the incoming combatant when core never starts the turn on nextRound', async () => {
			const combatId = 'combat-backstop-next-round';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			advanceWithoutTurnEvents('nextRound', incoming);

			await combat.nextRound();

			expect(clearedIds(combat)).toEqual([['incoming']]);
		});

		it('clears the whole minion group when the incoming combatant is a group leader', async () => {
			const combatId = 'combat-backstop-minion-group';
			const hero = createHero('hero', combatId, 0);
			const leader = createMinion('minion-leader', combatId, 'group-1', 'leader');
			const member = createMinion('minion-member', combatId, 'group-1', 'member');
			const combat = buildCombat(combatId, [hero, leader, member]);
			advanceWithoutTurnEvents('nextTurn', leader);

			await combat.nextTurn();

			expect(clearedIds(combat)).toEqual([['minion-leader', 'minion-member']]);
		});

		it('does not clear again when core starts the turn late', async () => {
			const combatId = 'combat-backstop-late-start';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			advanceWithoutTurnEvents('nextTurn', incoming);

			await combat.nextTurn();
			await combat._onStartTurn(incoming, turnContext(false));
			await combat._clearMovementHistoryOnStartTurn(incoming, turnContext(false));

			expect(clearedIds(combat)).toEqual([['incoming']]);
		});

		it('does not clear again when core already started the turn', async () => {
			const combatId = 'combat-backstop-core-started';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			const superNextTurn = globals().Combat.prototype.nextTurn as ReturnType<typeof vi.fn>;
			superNextTurn.mockImplementation(async function (this: AdvanceTarget) {
				this.turn = 1;
				this.combatant = incoming;
				const self = this as unknown as MovementHistoryCombat;
				await self._onStartTurn(incoming, turnContext(false));
				await self._clearMovementHistoryOnStartTurn(incoming, turnContext(false));
				return this;
			});

			await combat.nextTurn();

			expect(clearedIds(combat)).toEqual([['incoming']]);
		});

		it('leaves the history to the active GM', async () => {
			globals().game.user = {
				isGM: true,
				role: 4,
				isActiveGM: false,
			} as TestGlobals['game']['user'];
			const combatId = 'combat-backstop-not-active-gm';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			advanceWithoutTurnEvents('nextTurn', incoming);

			await combat.nextTurn();

			expect(combat.clearMovementHistories).not.toHaveBeenCalled();
		});

		it('clears nothing when movement tracking is off', async () => {
			setMovementTracking(false);
			const combatId = 'combat-backstop-toggle-off';
			const outgoing = createHero('outgoing', combatId);
			const incoming = createHero('incoming', combatId, 2);
			const combat = buildCombat(combatId, [outgoing, incoming]);
			advanceWithoutTurnEvents('nextTurn', incoming);

			await combat.nextTurn();

			expect(combat.clearMovementHistories).not.toHaveBeenCalled();
			expect(superClear).not.toHaveBeenCalled();
		});
	});
});
