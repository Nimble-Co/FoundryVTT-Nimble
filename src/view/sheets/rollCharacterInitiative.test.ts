import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createCombatActorFixture,
	createCombatantFixture,
	createCombatantsCollectionFixture,
} from '../../../tests/fixtures/combat.js';
import { characterInitiativeRoll } from './rollCharacterInitiative.js';

describe('characterInitiativeRoll', () => {
	beforeEach(() => {
		(game as any).combat = null;
		(game as any).combats = {
			contents: [],
			viewed: null,
		};
		(globalThis as typeof globalThis & { canvas: typeof canvas }).canvas = {
			scene: {
				id: 'scene-1',
				tokens: {
					contents: [],
				},
			},
		} as unknown as typeof canvas;
	});

	it('rolls combat initiative only once while a sheet request is pending', async () => {
		let resolveCombatRoll: (() => void) | undefined;
		const actor = Object.assign(
			createCombatActorFixture({
				id: 'actor-sheet-initiative',
				type: 'character',
				isOwner: true,
			}),
			{
				getInitiativeRollData: vi.fn().mockResolvedValue({
					rollMode: 1,
					visibilityMode: 'blindroll',
				}),
				rollInitiativeToChat: vi.fn(),
			},
		);
		const actorId = actor.id ?? 'actor-sheet-initiative';
		const combatant = createCombatantFixture({
			id: 'combatant-sheet-initiative',
			type: 'character',
			isOwner: true,
			initiative: null,
			actor,
			actorId: actorId,
			sceneId: 'scene-1',
		});
		const combatants = createCombatantsCollectionFixture([combatant]);
		const combat = {
			active: true,
			started: true,
			scene: { id: 'scene-1' },
			combatants,
			turns: [combatant],
			setupTurns: vi.fn(() => [combatant]),
			rollInitiative: vi.fn(
				() =>
					new Promise<void>((resolve) => {
						resolveCombatRoll = resolve;
					}),
			),
		} as unknown as Combat & {
			rollInitiative: ReturnType<typeof vi.fn>;
			setupTurns: ReturnType<typeof vi.fn>;
		};

		(game as any).combat = combat;

		const firstRollRequest = characterInitiativeRoll.roll(actor as any);
		const secondRollRequest = characterInitiativeRoll.roll(actor as any);

		await Promise.resolve();

		expect(actor.getInitiativeRollData).toHaveBeenCalledTimes(1);
		expect(combat.rollInitiative).toHaveBeenCalledTimes(1);
		expect(combat.rollInitiative).toHaveBeenCalledWith(['combatant-sheet-initiative'], {
			messageOptions: { rollMode: 'blindroll' },
			rollOptions: { rollMode: 1 },
		});
		expect(actor.rollInitiativeToChat).not.toHaveBeenCalled();

		if (!resolveCombatRoll) {
			throw new Error('Expected sheet initiative roll to be pending.');
		}
		resolveCombatRoll();

		await Promise.all([firstRollRequest, secondRollRequest]);
	});

	it('adds a missing current-scene character combatant after the existing hero block before rolling', async () => {
		const actor = Object.assign(
			createCombatActorFixture({
				id: 'actor-sheet-initiative-late-joiner',
				type: 'character',
				isOwner: true,
			}),
			{
				getActiveTokens: vi.fn(() => [
					{
						document: {
							id: 'token-sheet-initiative-late-joiner',
							actorId: 'actor-sheet-initiative-late-joiner',
							hidden: false,
							parent: { id: 'scene-1' },
						},
					},
				]),
				getInitiativeRollData: vi.fn().mockResolvedValue({
					rollMode: -1,
					visibilityMode: 'gmroll',
				}),
				rollInitiativeToChat: vi.fn(),
				token: null,
			},
		);
		const existingHero = createCombatantFixture({
			id: 'combatant-sheet-initiative-hero',
			type: 'character',
			sort: 10,
			isOwner: true,
			initiative: 18,
			actor: createCombatActorFixture({
				id: 'actor-sheet-initiative-hero',
				type: 'character',
				isOwner: true,
			}),
			actorId: 'actor-sheet-initiative-hero',
			sceneId: 'scene-1',
		});
		const existingMonster = createCombatantFixture({
			id: 'combatant-sheet-initiative-monster',
			type: 'npc',
			sort: 20,
			initiative: 12,
			actor: createCombatActorFixture({
				id: 'actor-sheet-initiative-monster',
				type: 'npc',
			}),
			actorId: 'actor-sheet-initiative-monster',
			sceneId: 'scene-1',
		});
		const combatants = createCombatantsCollectionFixture([existingHero, existingMonster]);
		const createdCombatant = createCombatantFixture({
			id: 'combatant-sheet-initiative-created',
			type: 'character',
			sort: 15,
			isOwner: true,
			initiative: null,
			actor,
			actorId: 'actor-sheet-initiative-late-joiner',
			tokenId: 'token-sheet-initiative-late-joiner',
			sceneId: 'scene-1',
		});
		const combat = {
			active: true,
			started: true,
			scene: { id: 'scene-1' },
			combatants,
			turns: [existingHero, existingMonster],
			setupTurns: vi.fn(() => [existingHero, createdCombatant, existingMonster]),
			createEmbeddedDocuments: vi.fn(async (_documentName: string, createData: any[]) => {
				expect(createData).toEqual([
					expect.objectContaining({
						type: 'character',
						actorId: 'actor-sheet-initiative-late-joiner',
						tokenId: 'token-sheet-initiative-late-joiner',
						sceneId: 'scene-1',
						hidden: false,
						system: expect.objectContaining({ sort: 15 }),
					}),
				]);
				combatants.contents.push(createdCombatant);
				(combatants as unknown as Combatant.Implementation[]).push(createdCombatant);
				return [createdCombatant];
			}),
			rollInitiative: vi.fn().mockResolvedValue(null),
			_sortCombatants: vi.fn((left: Combatant.Implementation, right: Combatant.Implementation) => {
				const leftSort = Number((left.system as { sort?: number }).sort ?? 0);
				const rightSort = Number((right.system as { sort?: number }).sort ?? 0);
				return leftSort - rightSort;
			}),
		} as unknown as Combat & {
			createEmbeddedDocuments: ReturnType<typeof vi.fn>;
			rollInitiative: ReturnType<typeof vi.fn>;
			setupTurns: ReturnType<typeof vi.fn>;
			_sortCombatants: ReturnType<typeof vi.fn>;
		};

		(game as any).combat = combat;

		await characterInitiativeRoll.roll(actor as any);

		expect(actor.getInitiativeRollData).toHaveBeenCalledTimes(1);
		expect(combat.createEmbeddedDocuments).toHaveBeenCalledTimes(1);
		expect(combat.rollInitiative).toHaveBeenCalledWith(['combatant-sheet-initiative-created'], {
			messageOptions: { rollMode: 'gmroll' },
			rollOptions: { rollMode: -1 },
		});
		expect(actor.rollInitiativeToChat).not.toHaveBeenCalled();
	});

	it('does not post a chat initiative roll when the current combatant already has initiative', async () => {
		const actor = Object.assign(
			createCombatActorFixture({
				id: 'actor-sheet-initiative-rolled',
				type: 'character',
				isOwner: true,
			}),
			{
				getInitiativeRollData: vi.fn(),
				rollInitiativeToChat: vi.fn(),
			},
		);
		const actorId = actor.id ?? 'actor-sheet-initiative-rolled';
		const combatant = createCombatantFixture({
			id: 'combatant-sheet-initiative-rolled',
			type: 'character',
			isOwner: true,
			initiative: 14,
			actor,
			actorId: actorId,
			sceneId: 'scene-1',
		});
		const combatants = createCombatantsCollectionFixture([combatant]);
		const combat = {
			active: true,
			started: true,
			scene: { id: 'scene-1' },
			combatants,
			turns: [combatant],
			setupTurns: vi.fn(() => [combatant]),
			rollInitiative: vi.fn(),
		} as unknown as Combat & {
			rollInitiative: ReturnType<typeof vi.fn>;
			setupTurns: ReturnType<typeof vi.fn>;
		};

		(game as any).combat = combat;

		await characterInitiativeRoll.roll(actor as any);

		expect(ui.notifications?.info).toHaveBeenCalledWith(
			'Initiative has already been rolled for this combatant.',
		);
		expect(combat.rollInitiative).not.toHaveBeenCalled();
		expect(actor.getInitiativeRollData).not.toHaveBeenCalled();
		expect(actor.rollInitiativeToChat).not.toHaveBeenCalled();
	});
});
