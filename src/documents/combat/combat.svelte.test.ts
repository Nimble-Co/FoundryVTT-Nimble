import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleCombat } from './combat.svelte.js';

type TestGlobals = {
	game: {
		user: {
			isGM: boolean;
			role?: number;
		};
	};
	fromUuidSync: ReturnType<typeof vi.fn>;
	SortingHelpers: {
		performIntegerSort: ReturnType<typeof vi.fn>;
	};
	foundry: {
		applications: {
			ux: {
				TextEditor: {
					implementation: {
						getDragEventData: ReturnType<typeof vi.fn>;
					};
				};
			};
		};
	};
	Combat: {
		prototype: Record<string, unknown>;
	};
};

function globals() {
	return globalThis as unknown as TestGlobals;
}

function createActor({
	hp = 10,
	woundsValue,
	woundsMax,
}: {
	hp?: number;
	woundsValue?: number;
	woundsMax?: number;
}) {
	return {
		system: {
			attributes: {
				hp: { value: hp },
				wounds: { value: woundsValue, max: woundsMax },
			},
		},
	} as unknown as Actor.Implementation;
}

function createCombatant({
	id,
	type,
	sort,
	isOwner,
	initiative,
	defeated = false,
	actor,
	combatId,
}: {
	id: string;
	type: string;
	sort: number;
	isOwner: boolean;
	initiative: number | null;
	defeated?: boolean;
	actor: Actor.Implementation;
	combatId: string;
}) {
	return {
		id,
		_id: id,
		type,
		isOwner,
		defeated,
		initiative,
		system: {
			sort,
			actions: { base: { current: 1, max: 2 } },
		},
		actor,
		parent: { id: combatId },
		sceneId: 'scene-1',
		update: vi.fn().mockResolvedValue({ id }),
	} as unknown as Combatant.Implementation;
}

function createCombatantsCollection(combatants: Combatant.Implementation[]) {
	const collection = combatants as Combatant.Implementation[] & {
		contents: Combatant.Implementation[];
		get: (id: string) => Combatant.Implementation | null;
	};

	collection.contents = combatants;
	collection.get = (id: string) => combatants.find((combatant) => combatant.id === id) ?? null;

	return collection;
}

function createDropEvent({
	sourceId,
	targetId,
	before,
}: {
	sourceId: string;
	targetId: string;
	before: boolean;
}) {
	const trackerListElement = {
		dataset: {
			dragSourceId: sourceId,
			dropTargetId: targetId,
			dropBefore: String(before),
		},
		querySelector: vi.fn(),
	} as unknown as HTMLElement;

	const eventTarget = {
		closest: vi.fn((selector: string) => {
			if (selector === '.nimble-combatants') return trackerListElement;
			return null;
		}),
	} as unknown as HTMLElement;

	return {
		preventDefault: vi.fn(),
		target: eventTarget,
		y: 0,
	} as unknown as DragEvent & { target: EventTarget & HTMLElement };
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
		const deadCharacter = createCombatant({
			id: 'dead-character',
			type: 'character',
			sort: 1,
			isOwner: true,
			initiative: 10,
			actor: createActor({ hp: 0, woundsValue: 6, woundsMax: 6 }),
			combatId,
		});
		const aliveCharacter = createCombatant({
			id: 'alive-character',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 9,
			actor: createActor({ hp: 0, woundsValue: 2, woundsMax: 6 }),
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([deadCharacter, aliveCharacter]),
		} as unknown as Combat.CreateData);

		const turns = combat.setupTurns();
		expect(turns.map((combatant) => combatant.id)).toEqual(['alive-character']);
	});

	it('starts combat on the top-most character card after start initialization', async () => {
		const combatId = 'combat-start-order';
		const monster = createCombatant({
			id: 'monster-top',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 18,
			actor: createActor({ hp: 12 }),
			combatId,
		});
		const playerTop = createCombatant({
			id: 'player-top',
			type: 'character',
			sort: 2,
			isOwner: true,
			initiative: 11,
			actor: createActor({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const playerSecond = createCombatant({
			id: 'player-second',
			type: 'character',
			sort: 3,
			isOwner: true,
			initiative: 9,
			actor: createActor({ hp: 8, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});

		const combatants = createCombatantsCollection([monster, playerTop, playerSecond]);
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
		const source = createCombatant({
			id: 'source-npc',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actor: createActor({ hp: 10 }),
			combatId,
		});
		const target = createCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 9,
			actor: createActor({ hp: 10 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		globals().SortingHelpers.performIntegerSort.mockReturnValue([
			{ target: source, update: { 'system.sort': 3 } },
			{ target: target, update: { 'system.sort': 4 } },
		]);

		const dropEvent = createDropEvent({
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
		const source = createCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
		};

		(combat as any).updateEmbeddedDocuments = vi.fn();
		const dropEvent = createDropEvent({
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
		const source = createCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: false,
			initiative: 10,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData);

		const dropEvent = createDropEvent({
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
		const source = createCombatant({
			id: 'source-npc',
			type: 'npc',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createActor({ hp: 6 }),
			combatId,
		});
		const target = createCombatant({
			id: 'target-npc',
			type: 'npc',
			sort: 8,
			isOwner: false,
			initiative: 7,
			actor: createActor({ hp: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([source, target]),
			turns: [source, target],
		} as unknown as Combat.CreateData);

		const dropEvent = createDropEvent({
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
		const source = createCombatant({
			id: 'source-character',
			type: 'character',
			sort: 5,
			isOwner: true,
			initiative: 10,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const target = createCombatant({
			id: 'target-character',
			type: 'character',
			sort: 10,
			isOwner: false,
			initiative: 8,
			actor: createActor({ hp: 5, woundsValue: 0, woundsMax: 6 }),
			combatId,
		});
		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollection([source, target]),
			turns: [target, source],
		} as unknown as Combat.CreateData);

		const dropEvent = createDropEvent({
			sourceId: 'source-character',
			targetId: 'target-character',
			before: true,
		});

		const result = await combat._onDrop(dropEvent);
		expect(result).toBe(false);
		expect(source.update).not.toHaveBeenCalled();
	});
});
