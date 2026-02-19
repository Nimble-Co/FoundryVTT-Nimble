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
import {
	MINION_GROUPING_MODE_CANVAS_LITE,
	MINION_GROUPING_MODE_FULL,
	MINION_GROUPING_MODE_SETTING_KEY,
} from '../../utils/minionGroupingModes.js';
import { NimbleCombat } from './combat.svelte.js';

function globals() {
	return getTestGlobals<NimbleCombatDocumentTestGlobals>();
}

describe('NimbleCombat', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		globals().game.user = { isGM: true, role: 4 };
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((_namespace: string, key: string) =>
				key === MINION_GROUPING_MODE_SETTING_KEY ? MINION_GROUPING_MODE_FULL : undefined,
			),
		};
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

		expect(combat.update).toHaveBeenCalledWith({ turn: 1 });
		expect(combat.turn).toBe(1);
	});

	it('creates a minion group with shared initiative and leader/member roles', async () => {
		const combatId = 'combat-create-minion-group';
		const minionActorA = {
			...createCombatActorFixture({ id: 'minion-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'minion-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'minion-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'minion-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 3,
			actor: minionActorB,
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB]),
			turns: [minionA, minionB],
			turn: 1,
			combatant: minionB,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

		combat.updateEmbeddedDocuments = vi.fn().mockResolvedValue([]);
		combat.update = vi.fn().mockResolvedValue(combat);

		await combat.createMinionGroup(['minion-a', 'minion-b']);

		expect(combat.updateEmbeddedDocuments).toHaveBeenCalledTimes(1);
		const updates = combat.updateEmbeddedDocuments.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;

		expect(updates).toHaveLength(2);
		const groupIds = new Set(
			updates.map((update) => update['flags.nimble.minionGroup.id']).filter(Boolean),
		);
		expect(groupIds.size).toBe(1);

		expect(
			updates.find((update) => update._id === 'minion-a')?.['flags.nimble.minionGroup.role'],
		).toBe('leader');
		expect(
			updates.find((update) => update._id === 'minion-b')?.['flags.nimble.minionGroup.role'],
		).toBe('member');
		expect(
			new Set(updates.map((update) => update['flags.nimble.minionGroup.label']).filter(Boolean)),
		).toEqual(new Set(['A']));
		expect(
			new Set(
				updates
					.map((update) => update['flags.nimble.minionGroup.labelIndex'])
					.filter((value) => typeof value === 'number'),
			),
		).toEqual(new Set([0]));
		expect(
			new Set(
				updates
					.map((update) => update['flags.nimble.minionGroup.memberNumber'])
					.filter((value) => typeof value === 'number'),
			),
		).toEqual(new Set([1, 2]));
		expect(updates.find((update) => update._id === 'minion-b')?.initiative).toBe(15);
		expect(combat.update).toHaveBeenCalledWith({
			'flags.nimble.minionGrouping.nextLabelIndex': 1,
		});
		expect(combat.update).toHaveBeenCalledWith({ turn: 0 });
	});

	it('marks newly created groups as temporary in canvas lite mode', async () => {
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((_namespace: string, key: string) =>
				key === MINION_GROUPING_MODE_SETTING_KEY ? MINION_GROUPING_MODE_CANVAS_LITE : undefined,
			),
		};

		const combatId = 'combat-canvas-lite-temporary-group';
		const minionActorA = {
			...createCombatActorFixture({ id: 'canvas-lite-minion-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'canvas-lite-minion-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'canvas-lite-minion-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'canvas-lite-minion-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: minionActorB,
			combatId,
		});

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

		await combat.createMinionGroup(['canvas-lite-minion-a', 'canvas-lite-minion-b']);

		const updates = combat.updateEmbeddedDocuments.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		expect(updates).toHaveLength(2);
		expect(
			new Set(
				updates
					.map((update) => update['flags.nimble.minionGroup.temporary'])
					.filter((value) => typeof value === 'boolean'),
			),
		).toEqual(new Set([true]));
	});

	it('auto-dissolves grouped minions at round boundary in canvas lite mode', async () => {
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((_namespace: string, key: string) =>
				key === MINION_GROUPING_MODE_SETTING_KEY ? MINION_GROUPING_MODE_CANVAS_LITE : undefined,
			),
		};

		const combatId = 'combat-canvas-lite-round-boundary';
		const minionActorA = {
			...createCombatActorFixture({ id: 'canvas-lite-round-minion-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'canvas-lite-round-minion-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'canvas-lite-round-minion-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'canvas-lite-round-minion-b',
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
					id: 'canvas-lite-group-a',
					role: 'leader',
					label: 'A',
					labelIndex: 0,
					memberNumber: 1,
				},
			},
		};
		(minionB as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'canvas-lite-group-a',
					role: 'member',
					label: 'A',
					labelIndex: 0,
					memberNumber: 2,
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
			{ _id: 'canvas-lite-round-minion-a', 'flags.nimble.minionGroup': null },
			{ _id: 'canvas-lite-round-minion-b', 'flags.nimble.minionGroup': null },
		]);
	});

	it('preserves member numbers when removing and adding minions in a group', async () => {
		const combatId = 'combat-member-number-persistence';
		const minionActorA = {
			...createCombatActorFixture({ id: 'minion-num-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'minion-num-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorC = {
			...createCombatActorFixture({ id: 'minion-num-actor-c', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorD = {
			...createCombatActorFixture({ id: 'minion-num-actor-d', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'minion-num-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'minion-num-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 14,
			actor: minionActorB,
			combatId,
		});
		const minionC = createMockCombatant({
			id: 'minion-num-c',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 13,
			actor: minionActorC,
			combatId,
		});
		const minionD = createMockCombatant({
			id: 'minion-num-d',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 12,
			actor: minionActorD,
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB, minionC, minionD]),
			turns: [minionA, minionB, minionC, minionD],
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

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

		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;

						const target = combat.combatants.get(id);
						if (!target) continue;

						for (const [path, value] of Object.entries(update)) {
							if (path === '_id') continue;

							if (path.includes('.')) {
								foundry.utils.setProperty(target, path, value);
								continue;
							}

							(target as unknown as Record<string, unknown>)[path] = value;
						}
					}

					return updates as unknown as Combatant.Implementation[];
				},
			);

		const getMemberNumber = (combatantId: string): number | null => {
			const combatant = combat.combatants.get(combatantId);
			if (!combatant) return null;
			const value = foundry.utils.getProperty(combatant, 'flags.nimble.minionGroup.memberNumber');
			return typeof value === 'number' ? value : null;
		};

		await combat.createMinionGroup(['minion-num-a', 'minion-num-b', 'minion-num-c']);
		const createUpdates = combat.updateEmbeddedDocuments.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		const groupId = createUpdates[0]?.['flags.nimble.minionGroup.id'];
		expect(typeof groupId).toBe('string');

		expect(getMemberNumber('minion-num-a')).toBe(1);
		expect(getMemberNumber('minion-num-b')).toBe(2);
		expect(getMemberNumber('minion-num-c')).toBe(3);

		await combat.removeMinionsFromGroups(['minion-num-b']);

		expect(getMemberNumber('minion-num-a')).toBe(1);
		expect(getMemberNumber('minion-num-c')).toBe(3);
		const removedMinion = combat.combatants.get('minion-num-b');
		expect(removedMinion).toBeDefined();
		expect(foundry.utils.getProperty(removedMinion as object, 'flags.nimble.minionGroup')).toBe(
			null,
		);

		await combat.addMinionsToGroup(groupId as string, ['minion-num-d']);

		expect(getMemberNumber('minion-num-a')).toBe(1);
		expect(getMemberNumber('minion-num-c')).toBe(3);
		expect(getMemberNumber('minion-num-d')).toBe(4);
	});

	it('resets minion group letters to A when the last group is dissolved', async () => {
		const combatId = 'combat-minion-group-letter-sequence';
		const minionActorA = {
			...createCombatActorFixture({ id: 'minion-seq-actor-a', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorB = {
			...createCombatActorFixture({ id: 'minion-seq-actor-b', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorC = {
			...createCombatActorFixture({ id: 'minion-seq-actor-c', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorD = {
			...createCombatActorFixture({ id: 'minion-seq-actor-d', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const minionA = createMockCombatant({
			id: 'minion-seq-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 15,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'minion-seq-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 13,
			actor: minionActorB,
			combatId,
		});
		const minionC = createMockCombatant({
			id: 'minion-seq-c',
			type: 'npc',
			sort: 3,
			isOwner: false,
			initiative: 11,
			actor: minionActorC,
			combatId,
		});
		const minionD = createMockCombatant({
			id: 'minion-seq-d',
			type: 'npc',
			sort: 4,
			isOwner: false,
			initiative: 9,
			actor: minionActorD,
			combatId,
		});

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([minionA, minionB, minionC, minionD]),
			turns: [minionA, minionB, minionC, minionD],
			combatant: minionA,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

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
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;

						const target = combat.combatants.get(id);
						if (!target) continue;

						if (Object.hasOwn(update, 'flags.nimble.minionGroup')) {
							globals().foundry.utils.setProperty(
								target,
								'flags.nimble.minionGroup',
								update['flags.nimble.minionGroup'],
							);
						}

						if (Object.hasOwn(update, 'flags.nimble.minionGroup.id')) {
							globals().foundry.utils.setProperty(
								target,
								'flags.nimble.minionGroup.id',
								update['flags.nimble.minionGroup.id'],
							);
						}
						if (Object.hasOwn(update, 'flags.nimble.minionGroup.role')) {
							globals().foundry.utils.setProperty(
								target,
								'flags.nimble.minionGroup.role',
								update['flags.nimble.minionGroup.role'],
							);
						}
						if (Object.hasOwn(update, 'flags.nimble.minionGroup.label')) {
							globals().foundry.utils.setProperty(
								target,
								'flags.nimble.minionGroup.label',
								update['flags.nimble.minionGroup.label'],
							);
						}
						if (Object.hasOwn(update, 'flags.nimble.minionGroup.labelIndex')) {
							globals().foundry.utils.setProperty(
								target,
								'flags.nimble.minionGroup.labelIndex',
								update['flags.nimble.minionGroup.labelIndex'],
							);
						}
					}

					return updates as unknown as Combatant.Implementation[];
				},
			);

		await combat.createMinionGroup(['minion-seq-a', 'minion-seq-b']);

		const firstCreateUpdates = combat.updateEmbeddedDocuments.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		expect(
			new Set(
				firstCreateUpdates
					.map((update) => update['flags.nimble.minionGroup.label'])
					.filter(Boolean),
			),
		).toEqual(new Set(['A']));
		const firstGroupId = firstCreateUpdates[0]?.['flags.nimble.minionGroup.id'] as string;
		expect(typeof firstGroupId).toBe('string');

		await combat.dissolveMinionGroups([firstGroupId]);
		await combat.createMinionGroup(['minion-seq-c', 'minion-seq-d']);

		const secondCreateUpdates = combat.updateEmbeddedDocuments.mock.calls[2][1] as Array<
			Record<string, unknown>
		>;
		expect(
			new Set(
				secondCreateUpdates
					.map((update) => update['flags.nimble.minionGroup.label'])
					.filter(Boolean),
			),
		).toEqual(new Set(['A']));
		expect(
			new Set(
				secondCreateUpdates
					.map((update) => update['flags.nimble.minionGroup.labelIndex'])
					.filter((value) => typeof value === 'number'),
			),
		).toEqual(new Set([0]));
		expect(combat.update).toHaveBeenCalledWith({
			'flags.nimble.minionGrouping.nextLabelIndex': 0,
		});
		expect(combat.update).toHaveBeenCalledWith({
			'flags.nimble.minionGrouping.nextLabelIndex': 1,
		});
	});

	it('reuses the first available group letter when a middle group is dissolved', async () => {
		const combatId = 'combat-minion-group-first-available-letter';
		const actorIds = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
		const minionActors = actorIds.map(
			(id) =>
				({
					...createCombatActorFixture({ id: `minion-letter-actor-${id}`, hp: 1 }),
					type: 'minion',
				}) as unknown as Actor.Implementation,
		);
		const minions = actorIds.map((id, index) =>
			createMockCombatant({
				id: `minion-letter-${id}`,
				type: 'minion',
				sort: index + 1,
				isOwner: false,
				initiative: 20 - index,
				actor: minionActors[index],
				combatId,
			}),
		);

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture(minions),
			turns: [...minions],
			combatant: minions[0],
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
		};

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
		combat.updateEmbeddedDocuments = vi
			.fn()
			.mockImplementation(
				async (_documentName: string, updates: Array<Record<string, unknown>>) => {
					for (const update of updates) {
						const id = update._id as string | undefined;
						if (!id) continue;
						const target = combat.combatants.get(id);
						if (!target) continue;

						for (const [path, value] of Object.entries(update)) {
							if (path === '_id') continue;
							globals().foundry.utils.setProperty(target, path, value);
						}
					}

					return updates as unknown as Combatant.Implementation[];
				},
			);

		await combat.createMinionGroup(['minion-letter-a', 'minion-letter-b']);
		const createAUpdates = combat.updateEmbeddedDocuments.mock.calls[0][1] as Array<
			Record<string, unknown>
		>;
		const groupAId = createAUpdates[0]?.['flags.nimble.minionGroup.id'] as string;
		expect(
			new Set(createAUpdates.map((update) => update['flags.nimble.minionGroup.label'])),
		).toEqual(new Set(['A']));

		await combat.createMinionGroup(['minion-letter-c', 'minion-letter-d']);
		const createBUpdates = combat.updateEmbeddedDocuments.mock.calls[1][1] as Array<
			Record<string, unknown>
		>;
		const groupBId = createBUpdates[0]?.['flags.nimble.minionGroup.id'] as string;
		expect(
			new Set(createBUpdates.map((update) => update['flags.nimble.minionGroup.label'])),
		).toEqual(new Set(['B']));

		await combat.createMinionGroup(['minion-letter-e', 'minion-letter-f']);
		const createCUpdates = combat.updateEmbeddedDocuments.mock.calls[2][1] as Array<
			Record<string, unknown>
		>;
		expect(
			new Set(createCUpdates.map((update) => update['flags.nimble.minionGroup.label'])),
		).toEqual(new Set(['C']));

		await combat.dissolveMinionGroups([groupBId]);
		await combat.createMinionGroup(['minion-letter-g', 'minion-letter-h']);

		const createAfterDissolveUpdates = combat.updateEmbeddedDocuments.mock.calls[4][1] as Array<
			Record<string, unknown>
		>;
		expect(
			new Set(createAfterDissolveUpdates.map((update) => update['flags.nimble.minionGroup.label'])),
		).toEqual(new Set(['B']));
		expect(
			new Set(
				createAfterDissolveUpdates
					.map((update) => update['flags.nimble.minionGroup.labelIndex'])
					.filter((value) => typeof value === 'number'),
			),
		).toEqual(new Set([1]));
		expect(groupAId).not.toEqual(groupBId);
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
						activation: { effects: [{ type: 'damage' }] },
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
						activation: { effects: [{ type: 'damage' }] },
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
					label: 'A',
					labelIndex: 0,
					memberNumber: 1,
				},
			},
		};
		(minionB as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: {
					id: 'group-attack-1',
					role: 'member',
					label: 'A',
					labelIndex: 0,
					memberNumber: 2,
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
			groupId: 'group-attack-1',
			targetTokenId: 'target-token-1',
			selections: [
				{ memberCombatantId: 'group-attack-a', actionId: 'action-a' },
				{ memberCombatantId: 'group-attack-b', actionId: 'action-b' },
			],
			endTurn: true,
		});

		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).toHaveBeenCalledWith('action-a', { fastForward: true });
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).toHaveBeenCalledWith('action-b', { fastForward: true });
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

	it('requires exactly one matching target for minion group attacks', async () => {
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
						activation: { effects: [{ type: 'damage' }] },
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
					label: 'A',
					labelIndex: 0,
					memberNumber: 1,
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
			groupId: 'group-attack-target-1',
			targetTokenId: 'target-token-expected',
			selections: [{ memberCombatantId: 'group-attack-target-a', actionId: 'action-a' }],
			endTurn: true,
		});

		expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		expect(combat.nextTurn).not.toHaveBeenCalled();
		expect(result.rolledCombatantIds).toEqual([]);
		expect(result.endTurnApplied).toBe(false);
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
						activation: { effects: [{ type: 'damage' }] },
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
						activation: { effects: [{ type: 'damage' }] },
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
			groupId: '',
			memberCombatantIds: ['group-attack-adhoc-a', 'group-attack-adhoc-b'],
			targetTokenId: 'target-token-adhoc',
			selections: [
				{ memberCombatantId: 'group-attack-adhoc-a', actionId: 'action-a' },
				{ memberCombatantId: 'group-attack-adhoc-b', actionId: 'action-b' },
			],
			endTurn: true,
		});

		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).toHaveBeenCalledWith('action-a', { fastForward: true });
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).toHaveBeenCalledWith('action-b', { fastForward: true });
		expect(combat.nextTurn).toHaveBeenCalledTimes(1);
		expect(result.rolledCombatantIds).toEqual(['group-attack-adhoc-a', 'group-attack-adhoc-b']);
		expect(result.endTurnApplied).toBe(true);
	});

	it('creates a single combined chat card for canvas lite group attacks', async () => {
		(
			globals().game as unknown as {
				settings?: { get: ReturnType<typeof vi.fn> };
			}
		).settings = {
			get: vi.fn((namespace: string, key: string) => {
				if (namespace === 'nimble' && key === MINION_GROUPING_MODE_SETTING_KEY) {
					return MINION_GROUPING_MODE_CANVAS_LITE;
				}
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

		const combatId = 'combat-canvas-lite-group-attack-chat';
		const minionActorA = {
			...createCombatActorFixture({ id: 'canvas-lite-group-attack-actor-a', hp: 1 }),
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
			...createCombatActorFixture({ id: 'canvas-lite-group-attack-actor-b', hp: 1 }),
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
			id: 'canvas-lite-group-attack-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 1,
			actor: minionActorA,
			combatId,
		});
		const minionB = createMockCombatant({
			id: 'canvas-lite-group-attack-b',
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
		).user.targets = new Set([{ id: 'canvas-lite-target-token', name: 'Target' }]);

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
			groupId: '',
			memberCombatantIds: ['canvas-lite-group-attack-a', 'canvas-lite-group-attack-b'],
			targetTokenId: 'canvas-lite-target-token',
			selections: [
				{ memberCombatantId: 'canvas-lite-group-attack-a', actionId: 'action-a' },
				{ memberCombatantId: 'canvas-lite-group-attack-b', actionId: 'action-b' },
			],
			endTurn: false,
		});

		expect(chatCreate).toHaveBeenCalledTimes(1);
		expect(result.chatMessageId).toBe('group-attack-chat-1');
		expect(result.rolledCombatantIds).toEqual([
			'canvas-lite-group-attack-a',
			'canvas-lite-group-attack-b',
		]);
		expect(
			(minionActorA as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
		expect(
			(minionActorB as unknown as { activateItem: ReturnType<typeof vi.fn> }).activateItem,
		).not.toHaveBeenCalled();
	});

	it('skips exhausted non-character turns when advancing initiative', async () => {
		const combatId = 'combat-next-turn-skip-exhausted';
		const exhaustedNpcA = createMockCombatant({
			id: 'exhausted-npc-a',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 13,
			actionsCurrent: 0,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});
		const exhaustedNpcB = createMockCombatant({
			id: 'exhausted-npc-b',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 12,
			actionsCurrent: 0,
			actor: createCombatActorFixture({ hp: 6 }),
			combatId,
		});
		const character = createMockCombatant({
			id: 'active-character',
			type: 'character',
			sort: 3,
			isOwner: true,
			initiative: 11,
			actor: createCombatActorFixture({ hp: 8, woundsValue: 0, woundsMax: 6 }),
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
			combatants: createCombatantsCollectionFixture([exhaustedNpcA, exhaustedNpcB, character]),
			turns: [exhaustedNpcA, exhaustedNpcB, character],
			turn: 0,
			combatant: exhaustedNpcA,
		} as unknown as Combat.CreateData);

		await combat.nextTurn();

		expect(combat.combatant?.id).toBe('active-character');
		expect(superNextTurn).toHaveBeenCalledTimes(2);
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

		globals().SortingHelpers.performIntegerSort.mockReturnValue([
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
		expect(combat.update).toHaveBeenCalledWith({ turn: 0 });
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

	it('switches to group leader turn when the active minion is added into an existing group', async () => {
		const combatId = 'combat-add-minion-group-preserve-turn';
		const minionActorLeader = {
			...createCombatActorFixture({ id: 'minion-add-actor-leader', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorMember = {
			...createCombatActorFixture({ id: 'minion-add-actor-member', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;
		const minionActorActive = {
			...createCombatActorFixture({ id: 'minion-add-actor-active', hp: 1 }),
			type: 'minion',
		} as unknown as Actor.Implementation;

		const leader = createMockCombatant({
			id: 'group-leader',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorLeader,
			combatId,
		});
		const member = createMockCombatant({
			id: 'group-member',
			type: 'npc',
			sort: 1,
			isOwner: false,
			initiative: 12,
			actor: minionActorMember,
			combatId,
		});
		const activeMinion = createMockCombatant({
			id: 'active-minion',
			type: 'npc',
			sort: 2,
			isOwner: false,
			initiative: 11,
			actor: minionActorActive,
			combatId,
		});

		(leader as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: { id: 'group-1', role: 'leader', label: 'A', labelIndex: 0, memberNumber: 1 },
			},
		};
		(member as unknown as { flags: Record<string, unknown> }).flags = {
			nimble: {
				minionGroup: { id: 'group-1', role: 'member', label: 'A', labelIndex: 0, memberNumber: 2 },
			},
		};

		const combat = new NimbleCombat({
			id: combatId,
			combatants: createCombatantsCollectionFixture([leader, member, activeMinion]),
			turns: [leader, activeMinion],
			turn: 1,
			combatant: activeMinion,
		} as unknown as Combat.CreateData) as NimbleCombat & {
			updateEmbeddedDocuments: ReturnType<typeof vi.fn>;
			update: ReturnType<typeof vi.fn>;
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

						for (const [path, value] of Object.entries(update)) {
							if (path === '_id') continue;
							if (path.includes('.')) {
								foundry.utils.setProperty(target, path, value);
								continue;
							}
							(target as unknown as Record<string, unknown>)[path] = value;
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

		await combat.addMinionsToGroup('group-1', ['active-minion']);

		expect(combat.turn).toBe(0);
		expect(combat.update).toHaveBeenCalledWith({ turn: 0 });
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
