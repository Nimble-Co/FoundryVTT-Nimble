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
import { NimbleCombat } from './combat.svelte.js';

function globals() {
	return getTestGlobals<NimbleCombatDocumentTestGlobals>();
}

describe('NimbleCombat', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		globals().game.user = { isGM: true, role: 4 };
		globals().fromUuidSync = vi.fn().mockReturnValue(null);
		globals().SortingHelpers = {
			performIntegerSort: vi.fn(),
		};

		const combatPrototype = globals().Combat.prototype;
		combatPrototype.startCombat = vi.fn(async function (this: Combat) {
			return this;
		});
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

		const textEditorImpl =
			globals().foundry.applications.ux.TextEditor.implementation.getDragEventData;
		textEditorImpl.mockReturnValue({});
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
			Object.assign(combat, updateData);
			return combat;
		});

		await combat.startCombat();

		expect(combat.update).toHaveBeenCalledWith({ turn: 1 });
		expect(combat.turn).toBe(1);
	});

	it('allows GM drop reorder for all active combatant types', async () => {
		globals().game.user.isGM = true;
		const combatId = 'combat-drop-gm';
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
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		globals().SortingHelpers.performIntegerSort.mockReturnValue([
			{ target: source, update: { 'system.sort': 3 } },
			{ target: target, update: { 'system.sort': 4 } },
		]);

		const dropEvent = createCombatDropEvent({
			sourceId: 'source-npc',
			targetId: 'target-npc',
			before: true,
		});

		await combat._onDrop(dropEvent);

		expect(globals().SortingHelpers.performIntegerSort).toHaveBeenCalled();
		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledWith('Combatant', [
			{
				_id: 'source-npc',
				'system.sort': 3,
			},
			{
				_id: 'target-npc',
				'system.sort': 4,
			},
		]);
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

	it('blocks below-trusted owners from reordering their own character cards', async () => {
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
