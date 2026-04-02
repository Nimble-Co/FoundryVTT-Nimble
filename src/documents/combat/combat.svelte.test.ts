import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantsCollectionFixture,
} from '../../../tests/fixtures/combat.js';
import {
	createCombatDropEvent,
	createMockCombatant,
	getTestGlobals,
	type NimbleCombatDocumentTestGlobals,
} from '../../../tests/mocks/combat.js';
import { initiativeRollLock } from '../../utils/initiativeRollLock.js';
import { NimbleCombat } from './combat.svelte.js';
import { clearExpandedTurnIdentityHint } from './expandedTurnIdentityStore.js';

function globals() {
	return getTestGlobals<NimbleCombatDocumentTestGlobals>();
}

type FoundryUtilsWithPerformIntegerSort = {
	performIntegerSort: ReturnType<typeof vi.fn>;
};

function foundryUtils(): FoundryUtilsWithPerformIntegerSort {
	return globals().foundry.utils as unknown as FoundryUtilsWithPerformIntegerSort;
}

describe('NimbleCombat', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		clearExpandedTurnIdentityHint('combat-legendary-next-turn-occurrence');
		clearExpandedTurnIdentityHint('combat-legendary-previous-turn-occurrence');
		clearExpandedTurnIdentityHint('combat-start-top-player');
		clearExpandedTurnIdentityHint('combat-start-local-combatant-sync');

		globals().game.user = { isGM: true, role: 4 };
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((namespace: string, key: string) => {
				if (namespace === 'core' && key === 'rollMode') return 'publicroll';
				return undefined;
			}),
		};
		globals().fromUuidSync = vi.fn().mockReturnValue(null);
		foundryUtils().performIntegerSort = vi.fn();

		const combatPrototype = globals().Combat.prototype;
		combatPrototype.startCombat = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype._onEndTurn = vi.fn(async () => undefined);
		combatPrototype.setupTurns = vi.fn(function (this: {
			combatants?: { contents?: Combatant.Implementation[] };
		}) {
			return this.combatants?.contents ?? [];
		});
		combatPrototype.nextTurn = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype.previousTurn = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype.nextRound = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype.previousRound = vi.fn(async function (this: Combat) {
			return this;
		});
		combatPrototype.createEmbeddedDocuments = vi.fn(async function (
			this: Combat,
			_embeddedName: string,
			data: unknown,
		) {
			return data as foundry.abstract.Document.StoredForName<Combat.Embedded.Name>[] | undefined;
		});

		const textEditorImpl =
			globals().foundry.applications.ux.TextEditor.implementation.getDragEventData;
		textEditorImpl.mockReturnValue({});

		(
			globalThis as unknown as {
				ChatMessage: {
					create: ReturnType<typeof vi.fn>;
					implementation: {
						create: ReturnType<typeof vi.fn>;
					};
					getSpeaker: ReturnType<typeof vi.fn>;
					applyRollMode: ReturnType<typeof vi.fn>;
				};
			}
		).ChatMessage = {
			create: vi.fn().mockResolvedValue({ id: 'chat-message' }),
			implementation: {
				create: vi.fn().mockResolvedValue([{ id: 'chat-message' }]),
			},
			getSpeaker: vi.fn().mockReturnValue({}),
			applyRollMode: vi.fn(),
		};
		(
			globalThis as unknown as {
				CONST: { CHAT_MESSAGE_STYLES: { OTHER: number } };
			}
		).CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
		(
			globalThis as unknown as {
				CONFIG: { sounds: { dice: string } };
			}
		).CONFIG.sounds = { dice: 'dice' };
	});

	it('filters dead combatants out of setupTurns', () => {
		const combatId = 'combat-setup-turns';
		const deadCharacter = createMockCombatant({
			id: 'dead-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 0, woundsValue: 6, woundsMax: 6 }),
			combatId,
		});
		const aliveCharacter = createMockCombatant({
			id: 'alive-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 9,
			actor: createCombatActorFixture({ hp: 0, woundsValue: 2, woundsMax: 6 }),
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([deadCharacter, aliveCharacter]),
		} as unknown as Combat.CreateData);

		const turns = combat.setupTurns();
		expect(turns.map((combatant) => combatant.id)).toEqual(['alive-character']);
	});

	it('collapses grouped minions into a single shared turn entry', () => {
		const combatId = 'combat-minion-groups';
		const minionActorLeader = {
			...createCombatActorFixture({ id: 'minion-actor-leader', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorMember = {
			...createCombatActorFixture({ id: 'minion-actor-member', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const npcActor = {
			...createCombatActorFixture({ id: 'npc-actor', hp: 8 }),
			type: 'npc',
		} as unknown as Actor.Implementation;

		const groupLeader = createMockCombatant({
			id: 'minion-leader',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorLeader,
			combatId,
		});
		const groupMember = createMockCombatant({
			id: 'minion-member',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: minionActorMember,
			combatId,
		});
		const otherNpc = createMockCombatant({
			id: 'other-npc',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 9,
			actor: npcActor,
			combatId,
		});

		(groupLeader as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: { minionGroup: { id: 'minion-group-1', role: 'leader' } },
		};
		(groupMember as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: { minionGroup: { id: 'minion-group-1', role: 'member' } },
		};

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([groupLeader, groupMember, otherNpc]),
		} as unknown as Combat.CreateData);

		const turns = combat.setupTurns();
		expect(turns.map((combatant) => combatant.id)).toEqual(['minion-leader', 'other-npc']);
	});

	it('inserts legendary turns after each player turn', () => {
		const combatId = 'combat-legendary-interleave';
		const playerOne = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 16,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const playerTwo = createMockCombatant({
			id: 'player-two',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 14,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const legendary = createMockCombatant({
			id: 'legendary-one',
			type: 'soloMonster',
			sort: 3,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 40 }),
			combatId,
		});
		const npc = createMockCombatant({
			id: 'npc-one',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 12 }),
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([playerOne, playerTwo, legendary, npc]),
		} as unknown as Combat.CreateData);

		const turns = combat.setupTurns();
		expect(turns.map((combatant) => combatant.id)).toEqual([
			'player-one',
			'legendary-one',
			'player-two',
			'legendary-one',
			'npc-one',
		]);
	});

	it('duplicates multiple legendary combatants after each player turn in turn order', () => {
		const combatId = 'combat-legendary-interleave-multiple';
		const playerOne = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 18,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const firstLegendary = createMockCombatant({
			id: 'legendary-one',
			type: 'soloMonster',
			sort: 2,
			isOwner: false,
			initiative: 17,
			actor: createCombatActorFixture({ hp: 40 }),
			combatId,
		});
		const secondLegendary = createMockCombatant({
			id: 'legendary-two',
			type: 'soloMonster',
			sort: 3,
			isOwner: false,
			initiative: 16,
			actor: createCombatActorFixture({ hp: 42 }),
			combatId,
		});
		const playerTwo = createMockCombatant({
			id: 'player-two',
			type: 'character',
			sort: 4,
			isOwner: true,
			initiative: 15,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const npc = createMockCombatant({
			id: 'npc-one',
			type: 'npc',
			sort: 5,
			isOwner: false,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 12 }),
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([
				playerOne,
				firstLegendary,
				secondLegendary,
				playerTwo,
				npc,
			]),
		} as unknown as Combat.CreateData);

		const turns = combat.setupTurns();
		expect(turns.map((combatant) => combatant.id)).toEqual([
			'player-one',
			'legendary-one',
			'legendary-two',
			'player-two',
			'legendary-one',
			'legendary-two',
			'npc-one',
		]);
	});

	it('preserves the second solo turn occurrence when advancing from the second player turn', async () => {
		const combatId = 'combat-legendary-next-turn-occurrence';
		const playerOne = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 16,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const playerTwo = createMockCombatant({
			id: 'player-two',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 14,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const legendary = createMockCombatant({
			id: 'legendary-one',
			type: 'soloMonster',
			sort: 3,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 40 }),
			combatId,
		});

		const superNextTurn = globals().Combat.prototype.nextTurn as ReturnType<typeof vi.fn>;
		superNextTurn.mockImplementation(async function (
			this: Combat & {
				turn?: number;
				turns?: Combatant.Implementation[];
				combatant?: Combatant.Implementation | null;
			},
		) {
			// Simulate Foundry returning a raw turn index that no longer matches the expanded solo-turn list.
			this.turn = 2;
			this.combatant = legendary;
			return this;
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([playerOne, playerTwo, legendary]),
			turns: [playerOne, legendary, playerTwo, legendary],
			turn: 2,
			combatant: playerTwo,
		} as unknown as Combat.CreateData);
		(combat as NimbleCombat & { update: ReturnType<typeof vi.fn> }).update = vi
			.fn()
			.mockResolvedValue(combat);

		await combat.nextTurn();

		expect(combat.turn).toBe(3);
		expect(combat.combatant?.id).toBe('legendary-one');
		expect(
			(combat as NimbleCombat & { update: ReturnType<typeof vi.fn> }).update,
		).toHaveBeenCalledWith({
			turn: 3,
			'flags.nimble.expandedTurnIdentity': {
				combatantId: 'legendary-one',
				occurrence: 1,
			},
		});
	});

	it('preserves the player turn when rewinding from a later solo turn occurrence', async () => {
		const combatId = 'combat-legendary-previous-turn-occurrence';
		const playerOne = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 16,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const playerTwo = createMockCombatant({
			id: 'player-two',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 14,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const legendary = createMockCombatant({
			id: 'legendary-one',
			type: 'soloMonster',
			sort: 3,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 40 }),
			combatId,
		});

		const superPreviousTurn = globals().Combat.prototype.previousTurn as ReturnType<typeof vi.fn>;
		superPreviousTurn.mockImplementation(async function (
			this: Combat & {
				turn?: number;
				turns?: Combatant.Implementation[];
				combatant?: Combatant.Implementation | null;
			},
		) {
			// Simulate Foundry returning the raw player index while the expanded list still contains two solo turns.
			this.turn = 1;
			this.combatant = playerTwo;
			return this;
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([playerOne, playerTwo, legendary]),
			turns: [playerOne, legendary, playerTwo, legendary],
			turn: 3,
			combatant: legendary,
		} as unknown as Combat.CreateData);
		(combat as NimbleCombat & { update: ReturnType<typeof vi.fn> }).update = vi
			.fn()
			.mockResolvedValue(combat);

		await combat.previousTurn();

		expect(combat.turn).toBe(2);
		expect(combat.combatant?.id).toBe('player-two');
		expect(
			(combat as NimbleCombat & { update: ReturnType<typeof vi.fn> }).update,
		).toHaveBeenCalledWith({
			turn: 2,
			'flags.nimble.expandedTurnIdentity': {
				combatantId: 'player-two',
				occurrence: 0,
			},
		});
	});

	it('restores non-player actions to max when rewinding to a previous monster turn', async () => {
		const combatId = 'combat-rewind-restore-monster-actions';
		const monster = createMockCombatant({
			id: 'monster-rewind',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 0,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const player = createMockCombatant({
			id: 'player-current',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});

		const superPreviousTurn = globals().Combat.prototype.previousTurn as ReturnType<typeof vi.fn>;
		superPreviousTurn.mockImplementation(async function (
			this: Combat & {
				turn?: number;
				combatant?: Combatant.Implementation | null;
			},
		) {
			this.turn = 0;
			this.combatant = monster;
			return this;
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([monster, player]),
			turns: [monster, player],
			turn: 1,
			combatant: player,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			update: ReturnType<typeof vi.fn>;
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.update = vi.fn().mockResolvedValue(combat);
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const target = combat.combatants.get(id);
						if (!target) continue;
						const nextActions = update['system.actions.base.current'];
						if (typeof nextActions === 'number') {
							foundry.utils.setProperty(target, 'system.actions.base.current', nextActions);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);

		await combat.previousTurn();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'monster-rewind',
				'system.actions.base.current': 3,
			},
		]);
		expect(foundry.utils.getProperty(monster, 'system.actions.base.current')).toBe(3);
	});

	it('restores all alive minion-group member actions when rewinding to the group turn', async () => {
		const combatId = 'combat-rewind-restore-minion-group-actions';
		const leaderActor = {
			...createCombatActorFixture({ id: 'minion-leader-actor', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const memberActor = {
			...createCombatActorFixture({ id: 'minion-member-actor', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const player = createMockCombatant({
			id: 'player-current',
			type: 'character',
			sort: 3,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const leader = createMockCombatant({
			id: 'minion-leader',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 0,
			actionsMax: 1,
			actor: leaderActor,
			combatId,
		});
		const member = createMockCombatant({
			id: 'minion-member',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 0,
			actionsMax: 1,
			actor: memberActor,
			combatId,
		});

		(leader as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: { minionGroup: { id: 'rewind-group-1', role: 'leader' } },
		};
		(member as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: { minionGroup: { id: 'rewind-group-1', role: 'member' } },
		};

		const superPreviousTurn = globals().Combat.prototype.previousTurn as ReturnType<typeof vi.fn>;
		superPreviousTurn.mockImplementation(async function (
			this: Combat & {
				turn?: number;
				combatant?: Combatant.Implementation | null;
			},
		) {
			this.turn = 0;
			this.combatant = leader;
			return this;
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([leader, member, player]),
			turns: [leader, player],
			turn: 1,
			combatant: player,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			update: ReturnType<typeof vi.fn>;
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.update = vi.fn().mockResolvedValue(combat);
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const target = combat.combatants.get(id);
						if (!target) continue;
						const nextActions = update['system.actions.base.current'];
						if (typeof nextActions === 'number') {
							foundry.utils.setProperty(target, 'system.actions.base.current', nextActions);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);

		await combat.previousTurn();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith(
			'Combatant',
			expect.arrayContaining([
				{
					_id: 'minion-leader',
					'system.actions.base.current': 1,
				},
				{
					_id: 'minion-member',
					'system.actions.base.current': 1,
				},
			]),
		);
		expect(foundry.utils.getProperty(leader, 'system.actions.base.current')).toBe(1);
		expect(foundry.utils.getProperty(member, 'system.actions.base.current')).toBe(1);
	});

	it('starts combat on the top-most character card after start initialization', async () => {
		const combatId = 'combat-start-order';
		const monster = createMockCombatant({
			id: 'monster-top',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 18,
			actor: createCombatActorFixture({ hp: 12 }),
			combatId,
		});
		const playerTop = createMockCombatant({
			id: 'player-top',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 11,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const playerSecond = createMockCombatant({
			id: 'player-second',
			type: 'character',
			sort: 3,
			isOwner: true,
			initiative: 9,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});

		const combatants = createCombatantsCollectionFixture([monster, playerTop, playerSecond]);
		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: 'scene-1' },
			combatants,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockImplementation(async (updateData: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(updateData)) {
				if (path.includes('.')) {
					globals().foundry.utils.setProperty(combat, path, value);
					continue;
				}
				(combat as unknown as Record<string, unknown>)[path] = value;
			}
			return combat;
		});

		await combat.startCombat();

		expect(combat.update).toHaveBeenCalledWith({
			turn: 1,
			'flags.nimble.expandedTurnIdentity': {
				combatantId: 'player-top',
				occurrence: 0,
			},
		});
		expect(combat.turn).toBe(1);
	});

	it('seeds the expanded turn identity hint for the chosen starting player turn at combat start', async () => {
		const combatId = 'combat-start-local-combatant-sync';
		const monster = createMockCombatant({
			id: 'monster-top',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 18,
			actor: createCombatActorFixture({ hp: 12 }),
			combatId,
		});
		const playerTop = createMockCombatant({
			id: 'player-top',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 15,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combatants = createCombatantsCollectionFixture([monster, playerTop]);
		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: 'scene-1' },
			combatants,
			turn: 0,
			combatant: monster,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			_nimbleExpandedTurnIdentity?: { combatantId: string; occurrence: number | null } | null;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockImplementation(async (updateData: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(updateData)) {
				if (path.includes('.')) {
					globals().foundry.utils.setProperty(combat, path, value);
					continue;
				}
				(combat as unknown as Record<string, unknown>)[path] = value;
			}
			return combat;
		});

		await combat.startCombat();

		expect(combat.turn).toBe(1);
		expect(combat._nimbleExpandedTurnIdentity).toEqual({
			combatantId: 'player-top',
			occurrence: 0,
		});
	});

	it('auto-rolls unrolled character initiative and resets non-character actions at combat start', async () => {
		const combatId = 'combat-start-action-initialization';
		const unrolledCharacter = createMockCombatant({
			id: 'unrolled-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: null,
			actionsCurrent: 2,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const rolledCharacter = createMockCombatant({
			id: 'rolled-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 2,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const npc = createMockCombatant({
			id: 'npc-combatant',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 10,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: 'scene-1' },
			combatants: createCombatantsCollectionFixture([unrolledCharacter, rolledCharacter, npc]),
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
			rollInitiative: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockResolvedValue(combat);
		combat.rollInitiative = vi.fn().mockResolvedValue(combat);

		await combat.startCombat();

		expect(combat.rollInitiative).toHaveBeenCalledWith(['unrolled-character'], {
			updateTurn: false,
		});
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'npc-combatant', 'system.actions.base.current': 3 },
		]);
	});

	it('initializes newly created non-character combatants with usable current actions', async () => {
		const combatId = 'combat-create-combatant-action-initialization';
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([]),
		} as unknown as Combat.CreateData);

		const superCreateEmbeddedDocuments = globals().Combat.prototype
			.createEmbeddedDocuments as ReturnType<typeof vi.fn>;

		await combat.createEmbeddedDocuments('Combatant', [
			{
				_id: 'created-npc',
				type: 'npc',
				system: {
					actions: {
						base: {
							max: 3,
						},
					},
				},
			},
			{
				_id: 'created-minion',
				type: 'minion',
				system: {
					actions: {
						base: {
							max: 2,
						},
					},
				},
			},
			{
				_id: 'created-solo',
				type: 'soloMonster',
			},
			{
				_id: 'created-character',
				type: 'character',
			},
		] as unknown as foundry.abstract.Document.CreateDataForName<'Combatant'>[]);

		const normalizedData = superCreateEmbeddedDocuments.mock.calls[0]?.[1] as Array<
			Record<string, unknown>
		>;
		expect(normalizedData).toHaveLength(4);
		expect(normalizedData[0]?.type).toBe('npc');
		expect(foundry.utils.getProperty(normalizedData[0], 'system.actions.base.current')).toBe(3);
		expect(normalizedData[1]?.type).toBe('npc');
		expect(foundry.utils.getProperty(normalizedData[1], 'system.actions.base.current')).toBe(2);
		expect(normalizedData[2]?.type).toBe('soloMonster');
		expect(foundry.utils.getProperty(normalizedData[2], 'system.actions.base.current')).toBe(1);
		expect(normalizedData[3]?.type).toBe('character');
		expect(foundry.utils.getProperty(normalizedData[3], 'system.actions.base.current')).toBe(
			undefined,
		);
	});

	it('creates a late-joining character after the last living character turn', async () => {
		const combatId = 'combat-late-join-character';
		const currentSceneId = 'scene-1';
		(globalThis as unknown as { canvas: { scene: { id: string } } }).canvas = {
			scene: { id: currentSceneId },
		} as unknown as { scene: { id: string } };

		const firstCharacter = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 0,
			isOwner: true,
			initiative: 15,
			actor: createCombatActorFixture({
				id: 'actor-player-one',
				type: 'character',
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
			}),
			combatId,
			sceneId: currentSceneId,
		});
		const secondCharacter = createMockCombatant({
			id: 'player-two',
			type: 'character',
			sort: 0,
			isOwner: true,
			initiative: 12,
			actor: createCombatActorFixture({
				id: 'actor-player-two',
				type: 'character',
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
			}),
			combatId,
			sceneId: currentSceneId,
		});
		const npc = createMockCombatant({
			id: 'npc-one',
			type: 'npc',
			sort: 0,
			isOwner: false,
			initiative: 9,
			actor: createCombatActorFixture({ id: 'actor-npc-one', type: 'npc', hp: 10 }),
			combatId,
			sceneId: currentSceneId,
		});

		const lateActor = createCombatActorFixture({
			id: 'actor-late-joiner',
			type: 'character',
			isOwner: true,
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
		}) as Actor.Implementation & {
			getActiveTokens: ReturnType<typeof vi.fn>;
		};
		lateActor.getActiveTokens = vi.fn().mockReturnValue([
			{
				id: 'token-late-joiner',
				hidden: false,
				parent: { id: currentSceneId },
			},
		]);

		const combatants = createCombatantsCollectionFixture([firstCharacter, secondCharacter, npc]);
		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: currentSceneId },
			combatants,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			createEmbeddedDocuments: ReturnType<typeof vi.fn>;
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(async (_embeddedName: string, updates: Record<string, unknown>[]) => {
				for (const update of updates) {
					const combatantId = update._id as string;
					const targetCombatant = combat.combatants.get(combatantId) as unknown as Record<
						string,
						unknown
					> | null;
					if (!targetCombatant) continue;

					for (const [path, value] of Object.entries(update)) {
						if (path === '_id') continue;
						foundry.utils.setProperty(targetCombatant, path, value);
					}
				}

				return [];
			});

		combat.createEmbeddedDocuments = vi
			.fn()
			.mockImplementation(async (_embeddedName: string, data: Record<string, unknown>[]) => {
				const createData = data[0] ?? {};
				const createdCombatant = createMockCombatant({
					id: 'late-joiner',
					type: 'character',
					sort: Number(foundry.utils.getProperty(createData, 'system.sort') ?? 0),
					isOwner: true,
					initiative: null,
					actor: lateActor,
					actorId: lateActor.id ?? '',
					tokenId: String(createData.tokenId ?? ''),
					sceneId: String(createData.sceneId ?? ''),
					combatId,
				});
				combatants.push(createdCombatant);
				return [createdCombatant];
			});

		const createdCombatant = await combat.ensureCharacterCombatantForActorInCurrentScene(lateActor);

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'player-one', 'system.sort': 1 },
			{ _id: 'player-two', 'system.sort': 2 },
			{ _id: 'npc-one', 'system.sort': 3 },
		]);
		expect(combat.createEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				type: 'character',
				actorId: 'actor-late-joiner',
				tokenId: 'token-late-joiner',
				sceneId: currentSceneId,
				hidden: false,
				system: {
					sort: 2.5,
				},
			},
		]);
		expect(createdCombatant?.id).toBe('late-joiner');
	});

	it('returns an existing current-scene character combatant without creating a duplicate', async () => {
		const combatId = 'combat-existing-late-join-character';
		const currentSceneId = 'scene-1';
		(globalThis as unknown as { canvas: { scene: { id: string } } }).canvas = {
			scene: { id: currentSceneId },
		} as unknown as { scene: { id: string } };

		const actor = createCombatActorFixture({
			id: 'actor-existing-character',
			type: 'character',
			isOwner: true,
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
		});
		const existingCombatant = createMockCombatant({
			id: 'existing-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: null,
			actor,
			actorId: actor.id ?? '',
			combatId,
			sceneId: currentSceneId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: currentSceneId },
			combatants: createCombatantsCollectionFixture([existingCombatant]),
		} as unknown as Combat.CreateData) as NimbleCombat & {
			createEmbeddedDocuments: ReturnType<typeof vi.fn>;
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.createEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const resolvedCombatant = await combat.ensureCharacterCombatantForActorInCurrentScene(actor);

		expect(resolvedCombatant).toBe(existingCombatant);
		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(combat.createEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('rolls initiative only once when concurrent requests target the same combatant', async () => {
		const combatId = 'combat-initiative-request-lock';
		const actor = createCombatActorFixture({
			id: 'actor-initiative-lock',
			type: 'character',
			isOwner: true,
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
		}) as Actor.Implementation & {
			update: ReturnType<typeof vi.fn>;
		};
		actor.update = vi.fn().mockResolvedValue(actor);

		const combatant = createMockCombatant({
			id: 'character-initiative-lock',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: null,
			actor,
			combatId,
			flags: {},
		}) as unknown as Combatant.Implementation & {
			getInitiativeRoll: ReturnType<typeof vi.fn>;
		};

		let resolveEvaluate: (() => void) | undefined;
		const initiativeRoll = {
			total: 17,
			evaluate: vi.fn(
				() =>
					new Promise((resolve) => {
						resolveEvaluate = () => resolve(initiativeRoll);
					}),
			),
			toMessage: vi.fn().mockResolvedValue({ id: 'initiative-chat-data' }),
		};
		combatant.getInitiativeRoll = vi.fn().mockReturnValue(initiativeRoll);

		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: 'scene-1' },
			combatants: createCombatantsCollectionFixture([combatant]),
			turns: [],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(async (_embeddedName: string, updates: Record<string, unknown>[]) => {
				for (const update of updates) {
					const combatantId = update._id as string;
					const targetCombatant = combat.combatants.get(combatantId) as unknown as Record<
						string,
						unknown
					> | null;
					if (!targetCombatant) continue;

					for (const [path, value] of Object.entries(update)) {
						if (path === '_id') continue;
						foundry.utils.setProperty(targetCombatant, path, value);
					}
				}

				return [];
			});
		combat.update = vi.fn().mockResolvedValue(combat);

		const chatMessageCreate = (
			globalThis as unknown as {
				ChatMessage: {
					implementation: {
						create: ReturnType<typeof vi.fn>;
					};
				};
			}
		).ChatMessage.implementation.create;
		const combatantId = combatant.id ?? '';
		if (combatantId.length < 1) {
			throw new Error('Expected combatant id for initiative concurrency test.');
		}

		const firstRollRequest = combat.rollInitiative([combatantId], { updateTurn: false });
		const secondRollRequest = combat.rollInitiative([combatantId], { updateTurn: false });

		await Promise.resolve();
		await Promise.resolve();

		expect(combatant.getInitiativeRoll).toHaveBeenCalledTimes(1);
		expect(initiativeRoll.evaluate).toHaveBeenCalledTimes(1);
		expect(initiativeRollLock.hasActiveLock(combatant)).toBe(true);

		if (!resolveEvaluate) {
			throw new Error('Expected initiative roll evaluation to be pending.');
		}
		resolveEvaluate();

		await Promise.all([firstRollRequest, secondRollRequest]);

		expect(combatant.initiative).toBe(17);
		expect(initiativeRollLock.hasActiveLock(combatant)).toBe(false);
		expect(chatMessageCreate).toHaveBeenCalledTimes(1);
		expect(chatMessageCreate).toHaveBeenCalledWith([
			expect.objectContaining({ id: 'initiative-chat-data' }),
		]);
	});

	it('skips rolling initiative when another client already holds the combatant lock', async () => {
		const combatId = 'combat-initiative-foreign-lock';
		globals().game.user = {
			id: 'current-user',
			isGM: true,
			role: 4,
		} as unknown as { isGM: boolean; role?: number };

		const actor = createCombatActorFixture({
			id: 'actor-initiative-foreign-lock',
			type: 'character',
			isOwner: true,
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
		});
		const combatant = createMockCombatant({
			id: 'character-initiative-foreign-lock',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: null,
			actor,
			combatId,
			flags: {
				nimble: {
					initiativeRollLock: {
						requestId: 'other-request',
						userId: 'other-user',
						startedAt: Date.now(),
					},
				},
			},
		}) as unknown as Combatant.Implementation & {
			getInitiativeRoll: ReturnType<typeof vi.fn>;
		};
		const getInitiativeRollSpy = vi.fn();
		combatant.getInitiativeRoll =
			getInitiativeRollSpy as unknown as typeof combatant.getInitiativeRoll;

		const combat = new NimbleCombat({
			id: combatId,
			scene: { id: 'scene-1' },
			combatants: createCombatantsCollectionFixture([combatant]),
			turns: [],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockResolvedValue(combat);

		const chatMessageCreate = (
			globalThis as unknown as {
				ChatMessage: {
					implementation: {
						create: ReturnType<typeof vi.fn>;
					};
				};
			}
		).ChatMessage.implementation.create;

		await combat.rollInitiative(['character-initiative-foreign-lock'], { updateTurn: false });

		expect(initiativeRollLock.hasActiveLock(combatant)).toBe(true);
		expect(getInitiativeRollSpy).not.toHaveBeenCalled();
		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(chatMessageCreate).not.toHaveBeenCalled();
	});

	it('marks a heroic reaction unavailable without spending an action when the GM toggles it off-turn', async () => {
		const combatId = 'combat-heroic-reaction-toggle';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('reacting-character', 'defend');

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'reacting-character',
				'system.actions.heroic.defendAvailable': false,
			},
		]);
	});

	it('re-enables a spent heroic reaction without refunding actions', async () => {
		const combatId = 'combat-heroic-reaction-reenable';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		foundry.utils.setProperty(reactingCharacter, 'system.actions.heroic.interposeAvailable', false);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'reacting-character',
			'interpose',
		);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'reacting-character',
				'system.actions.heroic.interposeAvailable': true,
			},
		]);
	});

	it('lets an owner use Defend off-turn without applying a condition', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-defend-owner-use';
		const activeActor = createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 });
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: activeActor,
			combatId,
		});
		const defendingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		defendingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		defendingActor.statuses = new Set();
		const defendingCharacter = createMockCombatant({
			id: 'defending-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: defendingActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, defendingCharacter]),
			turns: [activeCharacter, defendingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('defending-character', 'defend');

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'defending-character',
				'system.actions.heroic.defendAvailable': false,
				'system.actions.base.current': 2,
			},
		]);
		expect(defendingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('lets an owner use Interpose off-turn without applying a condition', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-interpose-owner-use';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const interposingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		interposingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		interposingActor.statuses = new Set();
		const interposingCharacter = createMockCombatant({
			id: 'interposing-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: interposingActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, interposingCharacter]),
			turns: [activeCharacter, interposingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'interposing-character',
			'interpose',
		);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'interposing-character',
				'system.actions.heroic.interposeAvailable': false,
				'system.actions.base.current': 2,
			},
		]);
		expect(interposingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('lets an owner use Opportunity Attack off-turn without applying a condition', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-opportunity-attack-owner-use';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		reactingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		reactingActor.statuses = new Set();
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: reactingActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'reacting-character',
			'opportunityAttack',
		);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'reacting-character',
				'system.actions.heroic.opportunityAttackAvailable': false,
				'system.actions.base.current': 2,
			},
		]);
		expect(reactingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('lets an owner use Help off-turn without applying a condition', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-help-owner-use';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const helpingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		helpingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		helpingActor.statuses = new Set();
		const helpingCharacter = createMockCombatant({
			id: 'helping-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: helpingActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, helpingCharacter]),
			turns: [activeCharacter, helpingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('helping-character', 'help');

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'helping-character',
				'system.actions.heroic.helpAvailable': false,
				'system.actions.base.current': 2,
			},
		]);
		expect(helpingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('uses a heroic reaction for sheet workflows and spends one action', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-sheet-defend-use';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const defendingCharacter = createMockCombatant({
			id: 'defending-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 2,
			actionsMax: 3,
			actor: createCombatActorFixture({
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
				isOwner: true,
			}),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, defendingCharacter]),
			turns: [activeCharacter, defendingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.useHeroicReactions('defending-character', ['defend']);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'defending-character',
				'system.actions.base.current': 1,
				'system.actions.heroic.defendAvailable': false,
			},
		]);
	});

	it('uses combined heroic reactions for sheet workflows and spends two actions', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-sheet-interpose-defend-use';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
				isOwner: true,
			}),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.useHeroicReactions('reacting-character', ['interpose', 'defend']);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'reacting-character',
				'system.actions.base.current': 1,
				'system.actions.heroic.interposeAvailable': false,
				'system.actions.heroic.defendAvailable': false,
			},
		]);
	});

	it('blocks combined sheet heroic reaction use when one reaction is already spent', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-sheet-combined-reaction-spent';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({
				hp: 8,
				woundsValue: 0,
				woundsMax: 6,
				isOwner: true,
			}),
			combatId,
		});
		foundry.utils.setProperty(reactingCharacter, 'system.actions.heroic.interposeAvailable', false);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.useHeroicReactions('reacting-character', ['interpose', 'defend']);

		expect(changed).toBe(false);
		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('re-enables Defend without touching actor conditions', async () => {
		const combatId = 'combat-defend-gm-reenable-clears-condition';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const defendingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		defendingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		defendingActor.statuses = new Set(['defending']);
		const defendingCharacter = createMockCombatant({
			id: 'defending-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: defendingActor,
			combatId,
		});
		foundry.utils.setProperty(defendingCharacter, 'system.actions.heroic.defendAvailable', false);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, defendingCharacter]),
			turns: [activeCharacter, defendingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('defending-character', 'defend');

		expect(changed).toBe(true);
		expect(defendingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('re-enables Interpose without touching actor conditions', async () => {
		const combatId = 'combat-interpose-gm-reenable-clears-condition';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const interposingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		interposingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		interposingActor.statuses = new Set(['interposing']);
		const interposingCharacter = createMockCombatant({
			id: 'interposing-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: interposingActor,
			combatId,
		});
		foundry.utils.setProperty(
			interposingCharacter,
			'system.actions.heroic.interposeAvailable',
			false,
		);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, interposingCharacter]),
			turns: [activeCharacter, interposingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'interposing-character',
			'interpose',
		);

		expect(changed).toBe(true);
		expect(interposingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('re-enables Opportunity Attack without touching actor conditions', async () => {
		const combatId = 'combat-opportunity-attack-gm-reenable-clears-condition';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const reactingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		reactingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		reactingActor.statuses = new Set(['opportunityAttacking']);
		const reactingCharacter = createMockCombatant({
			id: 'reacting-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: reactingActor,
			combatId,
		});
		foundry.utils.setProperty(
			reactingCharacter,
			'system.actions.heroic.opportunityAttackAvailable',
			false,
		);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, reactingCharacter]),
			turns: [activeCharacter, reactingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'reacting-character',
			'opportunityAttack',
		);

		expect(changed).toBe(true);
		expect(reactingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('re-enables Help without touching actor conditions', async () => {
		const combatId = 'combat-help-gm-reenable-clears-condition';
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const helpingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		helpingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		helpingActor.statuses = new Set(['helping']);
		const helpingCharacter = createMockCombatant({
			id: 'helping-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: helpingActor,
			combatId,
		});
		foundry.utils.setProperty(helpingCharacter, 'system.actions.heroic.helpAvailable', false);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter, helpingCharacter]),
			turns: [activeCharacter, helpingCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('helping-character', 'help');

		expect(changed).toBe(true);
		expect(helpingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('allows the GM to toggle a heroic reaction on the combatants own turn without spending an action', async () => {
		const combatId = 'combat-heroic-reaction-own-turn';
		const activeActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		activeActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		activeActor.statuses = new Set();
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: activeActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter]),
			turns: [activeCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability(
			'active-character',
			'opportunityAttack',
		);

		expect(changed).toBe(true);
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'active-character',
				'system.actions.heroic.opportunityAttackAvailable': false,
			},
		]);
		expect(activeActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('blocks an owner from using a heroic reaction on their own active turn', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-heroic-reaction-owner-own-turn';
		const activeActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
			isOwner: true,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		activeActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		activeActor.statuses = new Set();
		const activeCharacter = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 3,
			actionsMax: 3,
			actor: activeActor,
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([activeCharacter]),
			turns: [activeCharacter],
			turn: 0,
			combatant: activeCharacter,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const changed = await combat.toggleHeroicReactionAvailability('active-character', 'defend');

		expect(changed).toBe(false);
		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(activeActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('does not refresh heroic reactions for characters when a new round starts', async () => {
		const combatId = 'combat-heroic-reaction-round-refresh';
		const characterOne = createMockCombatant({
			id: 'character-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actionsCurrent: 2,
			actionsMax: 3,
			actor: Object.assign(createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }), {
				toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
				statuses: new Set(['defending', 'interposing', 'opportunityAttacking', 'helping']),
			}),
			combatId,
		});
		const characterTwo = createMockCombatant({
			id: 'character-two',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actionsCurrent: 1,
			actionsMax: 3,
			actor: Object.assign(createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }), {
				toggleStatusEffect: vi.fn().mockResolvedValue(undefined),
				statuses: new Set(),
			}),
			combatId,
		});
		foundry.utils.setProperty(characterOne, 'system.actions.heroic.defendAvailable', false);
		foundry.utils.setProperty(
			characterOne,
			'system.actions.heroic.opportunityAttackAvailable',
			false,
		);
		foundry.utils.setProperty(characterTwo, 'system.actions.heroic.helpAvailable', false);
		const combat = new NimbleCombat({
			id: combatId,
			round: 1,
			combatants: createCombatantsCollectionFixture([characterOne, characterTwo]),
			turns: [characterOne, characterTwo],
			turn: 0,
			combatant: characterOne,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockResolvedValue(combat);

		await combat.nextRound();

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(
			(
				characterOne.actor as Actor.Implementation & {
					toggleStatusEffect: ReturnType<typeof vi.fn>;
				}
			).toggleStatusEffect,
		).not.toHaveBeenCalled();
	});

	it('resets actions and refreshes heroic reactions at the end of the characters turn without touching reaction conditions', async () => {
		const defendingActor = createCombatActorFixture({
			hp: 8,
			woundsValue: 0,
			woundsMax: 6,
		}) as Actor.Implementation & {
			toggleStatusEffect: ReturnType<typeof vi.fn>;
			statuses: Set<string>;
		};
		defendingActor.toggleStatusEffect = vi.fn().mockResolvedValue(undefined);
		defendingActor.statuses = new Set([
			'defending',
			'interposing',
			'opportunityAttacking',
			'helping',
		]);
		const combatant = createMockCombatant({
			id: 'character-ending-turn',
			type: 'character',
			actionsCurrent: 1,
			actionsMax: 3,
			actor: defendingActor,
		});
		foundry.utils.setProperty(combatant, 'system.actions.heroic.defendAvailable', false);
		foundry.utils.setProperty(combatant, 'system.actions.heroic.interposeAvailable', false);
		foundry.utils.setProperty(combatant, 'system.actions.heroic.opportunityAttackAvailable', false);
		foundry.utils.setProperty(combatant, 'system.actions.heroic.helpAvailable', false);
		const combat = new NimbleCombat({
			id: 'combat-end-turn-defending',
			combatants: createCombatantsCollectionFixture([combatant]),
		} as unknown as Combat.CreateData);

		await combat._onEndTurn(combatant, {} as Combat.TurnEventContext);

		expect(combatant.update).toHaveBeenCalledWith({
			'system.actions.base.current': 3,
			'system.actions.heroic.defendAvailable': true,
			'system.actions.heroic.interposeAvailable': true,
			'system.actions.heroic.opportunityAttackAvailable': true,
			'system.actions.heroic.helpAvailable': true,
		});
		expect(defendingActor.toggleStatusEffect).not.toHaveBeenCalled();
	});

	it('auto-dissolves grouped minions at round boundary in ncs mode', async () => {
		const combatId = 'combat-ncs-round-boundary';
		const minionActorA = {
			...createCombatActorFixture({ id: 'ncs-round-minion-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'ncs-round-minion-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'ncs-round-minion-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'ncs-round-minion-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: minionActorB,
			combatId,
		});

		(minionA as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'ncs-group-a',
					role: 'leader',
				},
			},
		};
		(minionB as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'ncs-group-a',
					role: 'member',
				},
			},
		};

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB]),
			turns: [minionA, minionB],
			turn: 0,
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockResolvedValue(combat);

		await combat._onEndRound();

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledTimes(2);
		const dissolveUpdates = combat.updateEmbeddedDocuments.mock.calls[1][1] as Array<
			Record<string, unknown>
		>;
		expect(dissolveUpdates).toEqual([
			{ _id: 'ncs-round-minion-a', 'flags.nimble.minionGroup': null },
			{ _id: 'ncs-round-minion-b', 'flags.nimble.minionGroup': null },
		]);
	});

	it('performs a minion group attack, consumes member actions, and can end turn', async () => {
		const combatId = 'combat-minion-group-attack-success';
		const minionActorA = {
			...createCombatActorFixture({ id: 'group-attack-actor-a', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-a',
					type: 'monsterFeature',
					name: 'Stab',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'group-attack-actor-b', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-b',
					type: 'monsterFeature',
					name: 'Bite',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'group-attack-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'group-attack-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorB,
			combatId,
		});

		(minionA as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'group-attack-1',
					role: 'leader',
				},
			},
		};
		(minionB as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'group-attack-1',
					role: 'member',
				},
			},
		};

		(
			globals().game as unknown as {
				user: { targets?: Set<{ id: string; name?: string }> };
			}
		).user.targets = new Set([{ id: 'target-token-1', name: 'Target' }]);

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB]),
			turns: [minionA],
			turn: 0,
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			nextTurn: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const target = combat.combatants.get(id);
						if (!target) continue;
						const nextActions = update['system.actions.base.current'];
						if (typeof nextActions === 'number') {
							foundry.utils.setProperty(target, 'system.actions.base.current', nextActions);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);
		combat.nextTurn = vi.fn().mockResolvedValue(combat);

		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: ['group-attack-a', 'group-attack-b'],
			targetTokenIds: ['target-token-1'],
			selections: [
				{ memberCombatantId: 'group-attack-a', actionId: 'action-a' },
				{ memberCombatantId: 'group-attack-b', actionId: 'action-b' },
			],
			endTurn: true,
		});

		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'group-attack-a',
				'system.actions.base.current': 0,
			},
			{
				_id: 'group-attack-b',
				'system.actions.base.current': 0,
			},
		]);
		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
		expect(result.rolledCombatantIds).toEqual(['group-attack-a', 'group-attack-b']);
		expect(result.endTurnApplied).toBe(true);
	});

	it('uses currently targeted tokens when requested target id is not targeted', async () => {
		const combatId = 'combat-minion-group-attack-target-validation';
		const minionActorA = {
			...createCombatActorFixture({ id: 'group-attack-target-actor-a', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-a',
					type: 'monsterFeature',
					name: 'Stab',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'group-attack-target-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorA,
			combatId,
		});

		(minionA as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'group-attack-target-1',
					role: 'leader',
				},
			},
		};

		(
			globals().game as unknown as {
				user: { targets?: Set<{ id: string; name?: string }> };
			}
		).user.targets = new Set([{ id: 'other-target-token', name: 'Other Target' }]);

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA]),
			turns: [minionA],
			turn: 0,
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			nextTurn: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.nextTurn = vi.fn().mockResolvedValue(combat);

		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: ['group-attack-target-a'],
			targetTokenIds: ['target-token-expected'],
			selections: [{ memberCombatantId: 'group-attack-target-a', actionId: 'action-a' }],
			endTurn: true,
		});

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalled();
		expect(combat.nextTurn).toHaveBeenCalled();
		expect(result.rolledCombatantIds).toEqual(['group-attack-target-a']);
		expect(result.endTurnApplied).toBe(true);
		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
	});

	it('supports ad-hoc minion attack scope without a persisted group id', async () => {
		const combatId = 'combat-minion-group-attack-adhoc-scope';
		const minionActorA = {
			...createCombatActorFixture({ id: 'group-attack-adhoc-actor-a', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-a',
					type: 'monsterFeature',
					name: 'Stab',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'group-attack-adhoc-actor-b', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-b',
					type: 'monsterFeature',
					name: 'Bite',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'group-attack-adhoc-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'group-attack-adhoc-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorB,
			combatId,
		});

		(
			globals().game as unknown as {
				user: { targets?: Set<{ id: string; name?: string }> };
			}
		).user.targets = new Set([{ id: 'target-token-adhoc', name: 'Target' }]);

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB]),
			turns: [minionA, minionB],
			turn: 0,
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			nextTurn: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const target = combat.combatants.get(id);
						if (!target) continue;
						const nextActions = update['system.actions.base.current'];
						if (typeof nextActions === 'number') {
							foundry.utils.setProperty(target, 'system.actions.base.current', nextActions);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);
		combat.nextTurn = vi.fn().mockResolvedValue(combat);

		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: ['group-attack-adhoc-a', 'group-attack-adhoc-b'],
			targetTokenIds: ['target-token-adhoc'],
			selections: [
				{ memberCombatantId: 'group-attack-adhoc-a', actionId: 'action-a' },
				{ memberCombatantId: 'group-attack-adhoc-b', actionId: 'action-b' },
			],
			endTurn: true,
		});

		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
		expect(result.rolledCombatantIds).toEqual(['group-attack-adhoc-a', 'group-attack-adhoc-b']);
		expect(result.endTurnApplied).toBe(true);
	});

	it('creates a single combined chat card for ncs group attacks', async () => {
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((namespace: string, key: string) => {
				if (namespace === 'core' && key === 'rollMode') {
					return 'publicroll';
				}
				return undefined;
			}),
		};

		const chatCreate = vi.fn().mockResolvedValue({ id: 'group-attack-chat-1' });
		(
			globalThis as unknown as {
				ChatMessage: {
					create: ReturnType<typeof vi.fn>;
					getSpeaker: ReturnType<typeof vi.fn>;
					applyRollMode: ReturnType<typeof vi.fn>;
				};
			}
		).ChatMessage.create = chatCreate;
		(
			globalThis as unknown as {
				ChatMessage: { getSpeaker: ReturnType<typeof vi.fn> };
			}
		).ChatMessage.getSpeaker = vi.fn().mockReturnValue({});
		(
			globalThis as unknown as {
				ChatMessage: { applyRollMode: ReturnType<typeof vi.fn> };
			}
		).ChatMessage.applyRollMode = vi.fn();
		(
			globalThis as unknown as {
				CONST: { CHAT_MESSAGE_STYLES: { OTHER: number } };
			}
		).CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
		(
			globalThis as unknown as {
				CONFIG: { sounds: { dice: string } };
			}
		).CONFIG.sounds = { dice: 'dice' };

		const combatId = 'combat-ncs-group-attack-chat';
		const minionActorA = {
			...createCombatActorFixture({ id: 'ncs-group-attack-actor-a', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-a',
					type: 'monsterFeature',
					name: 'Stab',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
			getRollData: vi.fn().mockReturnValue({}),
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'ncs-group-attack-actor-b', hp: 1 }),
			type: 'minion',
			items: [
				{
					id: 'action-b',
					type: 'monsterFeature',
					name: 'Bite',
					system: {
						subtype: 'action',
						activation: { effects: [{ type: 'damage', formula: '1d6' }] },
					},
				},
			],
			activateItem: vi.fn().mockResolvedValue(null),
			getRollData: vi.fn().mockReturnValue({}),
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'ncs-group-attack-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'ncs-group-attack-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorB,
			combatId,
		});

		(
			globals().game as unknown as {
				user: {
					targets?: Set<{
						id: string;
						name?: string;
						document?: { id?: string; uuid?: string };
					}>;
				};
			}
		).user.targets = new Set([
			{
				id: 'ncs-target-token',
				name: 'Target',
				document: {
					id: 'ncs-target-token',
					uuid: 'Scene.scene.Token.ncs-target-token',
				},
			},
		]);

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB]),
			turns: [minionA, minionB],
			turn: 0,
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);

		const result = await combat.performMinionGroupAttack({
			memberCombatantIds: ['ncs-group-attack-a', 'ncs-group-attack-b'],
			targetTokenIds: ['ncs-target-token'],
			selections: [
				{ memberCombatantId: 'ncs-group-attack-a', actionId: 'action-a' },
				{ memberCombatantId: 'ncs-group-attack-b', actionId: 'action-b' },
			],
			endTurn: false,
		});

		expect(chatCreate).toHaveBeenCalledTimes(1);
		const createdChatData = chatCreate.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(createdChatData.type).toBe('minionGroupAttack');
		expect(createdChatData.content).toBe('');
		const createdSystem = createdChatData.system as Record<string, unknown>;
		expect(createdSystem.actorName).toBe('Selected Minions');
		expect(createdSystem.targetName).toBe('Target');
		expect(createdSystem.targets).toEqual(['Scene.scene.Token.ncs-target-token']);
		expect(createdSystem.totalDamage).toBe(result.totalDamage);
		const createdRows = createdSystem.rows as Array<Record<string, unknown>>;
		expect(createdRows).toHaveLength(2);
		expect(createdRows.map((row) => row.actionName)).toEqual(['Stab', 'Bite']);
		expect(createdRows.map((row) => row.formula)).toEqual(['1d6', '1d6']);
		expect(result.chatMessageId).toBe('group-attack-chat-1');
		expect(result.rolledCombatantIds).toEqual(['ncs-group-attack-a', 'ncs-group-attack-b']);
		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
	});

	it('does not skip exhausted non-character turns when advancing initiative', async () => {
		const combatId = 'combat-next-turn-skip-exhausted';
		const character = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 14,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const exhaustedNpcA = createMockCombatant({
			id: 'exhausted-npc-a',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 13,
			actionsCurrent: 0,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});
		const exhaustedNpcB = createMockCombatant({
			id: 'exhausted-npc-b',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 0,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});

		const superNextTurn = globals().Combat.prototype.nextTurn as ReturnType<typeof vi.fn>;
		superNextTurn.mockImplementation(async function (
			this: Combat & { turn?: number; turns?: Combatant.Implementation[] },
		) {
			const turns = this.turns ?? [];
			if (turns.length === 0) return this;
			const currentTurn = Number.isInteger(this.turn) ? Number(this.turn) : 0;
			const nextTurn = (currentTurn + 1) % turns.length;
			this.turn = nextTurn;
			(this as unknown as { combatant?: Combatant.Implementation | null }).combatant =
				turns[nextTurn] ?? null;
			return this;
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([character, exhaustedNpcA, exhaustedNpcB]),
			turns: [character, exhaustedNpcA, exhaustedNpcB],
			turn: 0,
			combatant: character,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			update: ReturnType<typeof vi.fn>;
		};

		combat.update = vi.fn().mockResolvedValue(combat);

		await combat.nextTurn();

		expect(combat.combatant?.id).toBe('exhausted-npc-a');
		expect(superNextTurn).toHaveBeenCalledTimes(1);
	});

	it('allows GM drop reorder for all active combatant types', async () => {
		globals().game.user.isGM = true;
		const combatId = 'combat-drop-gm';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 9,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		foundryUtils().performIntegerSort.mockReturnValue([
			{ target: source, update: { 'system.sort': 3 } },
			{ target: target, update: { 'system.sort': 4 } },
		]);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-npc',
			before: true,
		});

		await combat._onDrop(dropEvent);

		expect(foundryUtils().performIntegerSort).toHaveBeenCalled();
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'source-character',
				'system.sort': 3,
			},
			{
				_id: 'target-npc',
				'system.sort': 4,
			},
		]);
	});

	it('uses distinct visible turn siblings for GM reorder sorting', async () => {
		globals().game.user.isGM = true;
		const combatId = 'combat-drop-gm-turn-siblings';
		const source = createMockCombatant({
			id: 'source-npc',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 9,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const offTurnNpc = createMockCombatant({
			id: 'off-turn-npc',
			type: 'npc',
			sort: 6,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target, offTurnNpc]),
			turns: [source, target, target],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		foundryUtils().performIntegerSort.mockReturnValue([
			{ target: source, update: { 'system.sort': 3 } },
			{ target: target, update: { 'system.sort': 4 } },
		]);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-npc',
			targetId: 'target-npc',
			before: true,
		});

		await combat._onDrop(dropEvent);

		const siblings = foundryUtils().performIntegerSort.mock.calls[0]?.[1]
			?.siblings as Combatant.Implementation[];
		expect(siblings.map((combatant) => combatant.id)).toEqual(['target-npc']);
	});

	it('moves a collapsed monster stack as one block in real turn order', async () => {
		globals().game.user.isGM = true;
		const combatId = 'combat-drop-gm-stack-block';
		const playerOne = createMockCombatant({
			id: 'player-one',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 15,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const sourceOne = createMockCombatant({
			id: 'source-one',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const sourceTwo = createMockCombatant({
			id: 'source-two',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 11,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const activePlayer = createMockCombatant({
			id: 'active-player',
			type: 'character',
			sort: 4,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const targetOne = createMockCombatant({
			id: 'target-one',
			type: 'npc',
			sort: 5,
			isOwner: false,
			initiative: 9,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const targetTwo = createMockCombatant({
			id: 'target-two',
			type: 'npc',
			sort: 6,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([
				playerOne,
				sourceOne,
				sourceTwo,
				activePlayer,
				targetOne,
				targetTwo,
			]),
			turns: [playerOne, sourceOne, sourceTwo, activePlayer, targetOne, targetTwo],
			turn: 3,
			combatant: activePlayer,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.setupTurns = vi.fn(() =>
			[...combat.combatants.contents].sort((a, b) => combat._sortCombatants(a, b)),
		);
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const combatant = combat.combatants.get(id);
						if (!combatant) continue;
						const sort = update['system.sort'];
						if (typeof sort === 'number') {
							foundry.utils.setProperty(combatant, 'system.sort', sort);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);
		combat.update = vi.fn().mockImplementation(async (updateData: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(updateData)) {
				if (path.includes('.')) {
					foundry.utils.setProperty(combat, path, value);
					continue;
				}
				(combat as unknown as Record<string, unknown>)[path] = value;
			}
			return combat;
		});

		const dropEvent = createCombatDropEvent({
			sourceCombatantIds: ['source-one', 'source-two'],
			targetCombatantIds: ['target-one', 'target-two'],
			sourceKey: 'monster-stack-source-0',
			targetKey: 'monster-stack-target-1',
			before: false,
		});

		await combat._onDrop(dropEvent);

		expect(foundryUtils().performIntegerSort).not.toHaveBeenCalled();
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{ _id: 'player-one', 'system.sort': 1 },
			{ _id: 'active-player', 'system.sort': 2 },
			{ _id: 'target-one', 'system.sort': 3 },
			{ _id: 'target-two', 'system.sort': 4 },
			{ _id: 'source-one', 'system.sort': 5 },
			{ _id: 'source-two', 'system.sort': 6 },
		]);
		expect(combat.turns.map((combatant) => combatant.id)).toEqual([
			'player-one',
			'active-player',
			'target-one',
			'target-two',
			'source-one',
			'source-two',
		]);
		expect(combat.turn).toBe(1);
	});

	it('keeps the same active combatant when GM reorders cards mid-round', async () => {
		globals().game.user.isGM = true;
		const combatId = 'combat-drop-gm-preserve-active';
		const source = createMockCombatant({
			id: 'source-npc',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const active = createMockCombatant({
			id: 'active-npc',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, active, target]),
			turns: [source, active, target],
			turn: 1,
			combatant: active,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.setupTurns = vi.fn(() =>
			[...combat.combatants.contents].sort(
				(a, b) =>
					Number((a.system as unknown as { sort?: number }).sort ?? 0) -
					Number((b.system as unknown as { sort?: number }).sort ?? 0),
			),
		);
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const combatant = combat.combatants.get(id);
						if (!combatant) continue;
						const sort = update['system.sort'];
						if (typeof sort === 'number') {
							foundry.utils.setProperty(combatant, 'system.sort', sort);
						}
					}
					return updates as unknown as Combatant.Implementation[];
				},
			);
		combat.update = vi.fn().mockImplementation(async (updateData: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(updateData)) {
				if (path.includes('.')) {
					foundry.utils.setProperty(combat, path, value);
					continue;
				}
				(combat as unknown as Record<string, unknown>)[path] = value;
			}
			return combat;
		});

		foundryUtils().performIntegerSort.mockReturnValue([
			{ target: source, update: { 'system.sort': 4 } },
			{ target: active, update: { 'system.sort': 1 } },
			{ target: target, update: { 'system.sort': 2 } },
		]);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-npc',
			targetId: 'target-npc',
			before: false,
		});

		await combat._onDrop(dropEvent);

		expect(combat.turn).toBe(0);
		expect(combat.update).toHaveBeenCalledWith({
			turn: 0,
			'flags.nimble.expandedTurnIdentity': {
				combatantId: 'active-npc',
				occurrence: 0,
			},
		});
	});

	it('allows player owners to reorder their own character cards', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 2;
		const combatId = 'combat-drop-owner-character';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		(
			combat as unknown as { updateEmbeddedDocuments: ReturnType<typeof vi.fn> }
		).updateEmbeddedDocuments = vi.fn();
		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-character',
			before: true,
		});

		await combat._onDrop(dropEvent);

		expect(source.update).toHaveBeenCalledWith({
			'system.sort': expect.any(Number),
		});
		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('keeps the same active combatant locally when a player reorders their character card', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 2;
		const combatId = 'combat-drop-player-preserve-active';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 12,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const active = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-character',
			type: 'character',
			sort: 3,
			isOwner: false,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, active, target]),
			turns: [source, active, target],
			turn: 1,
			combatant: active,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.setupTurns = vi.fn(() =>
			[...combat.combatants.contents].sort(
				(a, b) =>
					Number((a.system as unknown as { sort?: number }).sort ?? 0) -
					Number((b.system as unknown as { sort?: number }).sort ?? 0),
			),
		);
		source.update = vi.fn().mockImplementation(async (updateData: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(updateData)) {
				if (path.includes('.')) {
					foundry.utils.setProperty(source, path, value);
					continue;
				}
				(source as unknown as Record<string, unknown>)[path] = value;
			}
			return source;
		});
		combat.update = vi.fn().mockResolvedValue(combat);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-character',
			before: false,
		});

		await combat._onDrop(dropEvent);

		expect(combat.turn).toBe(0);
		expect(combat.update).not.toHaveBeenCalled();
	});

	it('blocks non-owner players from reordering character cards they do not own', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 2;
		const combatId = 'combat-drop-non-owner-character';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: false,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-character',
			before: true,
		});

		const result = await combat._onDrop(dropEvent);
		expect(result).toBe(false);
		expect(source.update).not.toHaveBeenCalled();
	});

	it('blocks non-GM players from reordering non-character cards', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 2;
		const combatId = 'combat-drop-player-npc';
		const source = createMockCombatant({
			id: 'source-npc',
			type: 'npc',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 8,
			isOwner: false,
			initiative: 7,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-npc',
			targetId: 'target-npc',
			before: false,
		});

		const result = await combat._onDrop(dropEvent);
		expect(result).toBe(false);
		expect(source.update).not.toHaveBeenCalled();
	});

	it('blocks non-GM players from moving owned character cards outside the player section', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-drop-owner-character-cross-section';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-npc',
			before: true,
		});

		const result = await combat._onDrop(dropEvent);
		expect(result).toBe(false);
		expect(source.update).not.toHaveBeenCalled();
	});

	it('blocks untrusted owners from reordering their own character cards', async () => {
		globals().game.user.isGM = false;
		globals().game.user.role = 1;
		const combatId = 'combat-drop-untrusted-owner-character';
		const source = createMockCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createMockCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createCombatActorFixture({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-character',
			targetId: 'target-character',
			before: true,
		});

		const result = await combat._onDrop(dropEvent);
		expect(result).toBe(false);
		expect(source.update).not.toHaveBeenCalled();
	});
});
