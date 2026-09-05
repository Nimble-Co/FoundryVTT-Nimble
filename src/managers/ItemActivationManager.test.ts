import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { MockRollConstructor } from '../../tests/mocks/foundry.js';
import { keyPressStore } from '../stores/keyPressStore.js';
import { ChargePoolRuleConfig } from '../utils/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '../utils/dicePool/dicePoolRuleConfig.js';
import { findNodesByContexts } from '../utils/treeManipulation/findNodesByContexts.js';
import { ItemActivationManager, testDependencies } from './ItemActivationManager.js';

/** Mock roll instance interface */
interface MockRollInstance {
	evaluate: ReturnType<typeof vi.fn>;
	toJSON: ReturnType<typeof vi.fn>;
}

/** Mock actor interface for testing */
interface MockActor {
	uuid: string;
	token: { uuid: string } | null;
	getRollData: ReturnType<typeof vi.fn>;
	type?: string;
	// Only the charge-pool paths read these, so they stay optional rather than
	// forcing every fixture to describe an inventory it does not have.
	flags?: Record<string, unknown>;
	items?: { contents: MockItem[]; get(id: string): MockItem | undefined };
	system: {
		savingThrows: {
			strength: { mod: number };
			dexterity: { mod: number };
			will: { mod: number };
			intelligence: { mod: number };
		};
		levelUpHistory?: Array<Record<string, unknown>>;
	};
}

/** Mock item interface for testing */
interface MockItem {
	type: string;
	name: string;
	actor: MockActor | null;
	id?: string;
	flags?: Record<string, unknown>;
	rules?: Map<string, Record<string, unknown>>;
	update?: ReturnType<typeof vi.fn>;
	system: {
		activation: {
			effects: EffectNode[];
		};
	};
}

const mockReconstructEffectsTree = vi.fn();
const mockGetRollFormula = vi.fn();

// Mock dependencies - create proper vi.fn() based mocks that work as constructors
// The key is to use vi.fn() directly so all spy methods work, and have it return mock instances

function createMockRollInstance(): MockRollInstance {
	return {
		evaluate: vi.fn().mockResolvedValue(undefined),
		toJSON: vi.fn().mockReturnValue({ total: 0 }),
	};
}

// Create NimbleRoll as vi.fn() that returns mock instances when called with 'new'
const MockNimbleRoll = vi.fn(function NimbleRollMock(
	this: MockRollInstance,
	_formula: string,
	_data?: unknown,
) {
	const instance = createMockRollInstance();
	// When called with 'new', 'this' might be undefined with vi.fn(), so we return the instance
	// Returning an object from a constructor makes that object the result
	return instance;
}) as ReturnType<typeof vi.fn>;

// Create DamageRoll as vi.fn() that returns mock instances when called with 'new'
const MockDamageRoll = vi.fn(function DamageRollMock(
	this: MockRollInstance,
	_formula: string,
	_data?: unknown,
	_options?: unknown,
) {
	const instance = createMockRollInstance();
	return instance;
}) as ReturnType<typeof vi.fn>;

const DamageRoll = MockDamageRoll;
const NimbleRoll = MockNimbleRoll;
const getRollFormula = mockGetRollFormula;

// Dialog constructor mocks, injected through testDependencies because module
// mocks cannot intercept the manager's dialog imports (tests/setup.ts loads
// the real module graph before any test-file mocks register). The manager
// awaits `dialog.render(true)` and then `dialog.promise`, so each mock
// instance provides both; `dialogState.result` controls what the promise
// resolves to (null/undefined simulates a cancelled dialog).
const dialogState = { result: undefined as unknown };

function createMockDialogInstance() {
	return {
		render: vi.fn().mockResolvedValue(undefined),
		promise: Promise.resolve(dialogState.result),
	};
}

const MockItemActivationConfigDialog = vi.fn(function ItemActivationConfigDialogMock() {
	return createMockDialogInstance();
});

const MockSpellUpcastDialog = vi.fn(function SpellUpcastDialogMock() {
	return createMockDialogInstance();
});

// Helper function to create a mock implementation that handles 'new' correctly
// Returns the mockInstance directly since vitest doesn't properly bind 'this' for class mocks
function createMockConstructorImplementation(mockInstance: MockRollInstance) {
	// When a constructor returns an object, that object becomes the result of 'new'
	return function MockConstructor() {
		return mockInstance;
	};
}

const MockRoll = (
	globalThis as unknown as { foundry: { dice: { Roll: ReturnType<typeof vi.fn> } } }
).foundry.dice.Roll;

describe('ItemActivationManager.getData (rolls)', () => {
	let mockItem: MockItem;
	let mockActor: MockActor;
	let manager: ItemActivationManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetRollFormula.mockReturnValue('1d20');
		const gameGlobal = globalThis as unknown as { game: { user: { targets: unknown[] } } };
		if (!gameGlobal.game?.user?.targets) {
			gameGlobal.game.user.targets = [];
		}
		MockNimbleRoll.mockClear();
		MockDamageRoll.mockClear();
		// Reset MockRoll to default implementation
		MockRoll.mockImplementation(MockRollConstructor);
		// Reset reconstructEffectsTree mock - clear call history
		mockReconstructEffectsTree.mockReset();
		// Set default implementations for overrides
		mockReconstructEffectsTree.mockImplementation((effects: EffectNode[]) => effects || []);
		Object.assign(testDependencies, {
			NimbleRoll: MockNimbleRoll,
			DamageRoll: MockDamageRoll,
			getRollFormula: mockGetRollFormula,
			reconstructEffectsTree: mockReconstructEffectsTree,
			ItemActivationConfigDialog: MockItemActivationConfigDialog,
			SpellUpcastDialog: MockSpellUpcastDialog,
		});

		// Create mock actor
		mockActor = {
			uuid: 'actor-uuid-123',
			token: {
				uuid: 'token-uuid-456',
			},
			getRollData: vi.fn(() => ({ level: 1, strength: 10 })),
			system: {
				savingThrows: {
					strength: { mod: 2 },
					dexterity: { mod: 1 },
					will: { mod: 3 },
					intelligence: { mod: 0 },
				},
			},
		};

		// Create mock item
		mockItem = {
			type: 'weapon',
			name: 'Test Item',
			actor: mockActor,
			system: {
				activation: {
					effects: [],
				},
			},
		};

		// Create manager instance - cast mock to expected type
		manager = new ItemActivationManager(
			mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
			{},
		);
	});

	describe('Item types that return empty array', () => {
		it.each([['ancestry'], ['background'], ['boon'], ['class'], ['subclass']])(
			'should return empty array for %s item type',
			async (itemType) => {
				mockItem.type = itemType;
				manager = new ItemActivationManager(
					mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
					{ fastForward: true },
				);

				const result = await manager.getData();

				expect(result.rolls).toEqual([]);
				// flattenEffectsTree is not called for these item types
			},
		);
	});

	describe('Items with no effects', () => {
		it('should return empty array when activationData has no effects', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			manager.activationData = { effects: [] };
			// Set up mock for reconstructEffectsTree
			mockReconstructEffectsTree.mockReturnValue([]);

			const result = await manager.getData();

			expect(result.rolls).toEqual([]);
		});
	});

	describe('Saving throw effects', () => {
		it('should not create rolls for saving throw effects (targets roll from chat)', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const result = await manager.getData();

			// Saving throws should not create rolls during activation
			// Targets roll their saves from the chat card button instead
			expect(result.rolls).toEqual([]);
			expect(getRollFormula).not.toHaveBeenCalled();
			expect(NimbleRoll).not.toHaveBeenCalled();
		});

		it('should include saving throw node in activation data without roll', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'will',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const result = await manager.getData();

			// The activation data should still include the saving throw node
			// so the chat card can display the save DC and button
			expect(result.activation).not.toBeNull();
			expect(mockReconstructEffectsTree).toHaveBeenCalled();
		});
	});

	describe('Typed conditional-bonus damage', () => {
		it('rolls typed conditional damage as its own damage effect with the chosen type', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{
					fastForward: true,
					conditionalDamages: [{ formula: '2', damageType: 'fire', label: 'Quarry' }],
				},
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockImplementation((effects: EffectNode[]) => effects || []);

			// Primary node → DamageRoll; conditional damage → plain Roll. Give both a
			// concrete instance (the default MockRoll impl recurses on `new Roll`).
			vi.mocked(DamageRoll).mockImplementation(
				createMockConstructorImplementation({
					evaluate: vi.fn().mockResolvedValue(undefined),
					toJSON: vi.fn().mockReturnValue({ total: 8 }),
				}),
			);
			MockRoll.mockImplementation(function conditionalRoll(this: unknown) {
				return {
					evaluate: vi.fn().mockResolvedValue(undefined),
					toJSON: vi.fn(() => ({ total: 2 })),
				};
			});

			const result = await manager.getData();

			// One roll for the primary damage node, one for the typed conditional damage.
			expect(result.rolls).toHaveLength(2);
			const effects = result.activation?.effects as EffectNode[];
			const added = effects.find((n) => n.type === 'damage' && n.damageType === 'fire') as
				| { formula: string; roll?: unknown }
				| undefined;
			expect(added).toBeDefined();
			expect(added?.formula).toBe('2');
			expect(added?.roll).toBeDefined();
		});

		it('surfaces the typed conditional damage on a hit card', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{
					fastForward: true,
					conditionalDamages: [{ formula: '2', damageType: 'fire', label: 'Quarry' }],
				},
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockImplementation((effects: EffectNode[]) => effects || []);

			vi.mocked(DamageRoll).mockImplementation(
				createMockConstructorImplementation({
					evaluate: vi.fn().mockResolvedValue(undefined),
					toJSON: vi.fn().mockReturnValue({ total: 8 }),
				}),
			);
			MockRoll.mockImplementation(function conditionalRoll(this: unknown) {
				return {
					evaluate: vi.fn().mockResolvedValue(undefined),
					toJSON: vi.fn(() => ({ total: 2 })),
				};
			});

			const result = await manager.getData();

			const effects = result.activation?.effects as EffectNode[];
			const added = effects.find((n) => n.type === 'damage' && n.damageType === 'fire');
			const surfaced = findNodesByContexts([added as EffectNode], ['hit']);

			expect(surfaced).toHaveLength(1);
			expect(surfaced[0]).toMatchObject({ type: 'damageOutcome', parentNode: added?.id });
		});

		it('adds no extra effect when no typed conditional damage is supplied', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockImplementation((effects: EffectNode[]) => effects || []);

			vi.mocked(DamageRoll).mockImplementation(
				createMockConstructorImplementation({
					evaluate: vi.fn().mockResolvedValue(undefined),
					toJSON: vi.fn().mockReturnValue({ total: 8 }),
				}),
			);

			const result = await manager.getData();

			expect(result.rolls).toHaveLength(1);
			expect((result.activation?.effects as EffectNode[]).length).toBe(1);
		});
	});

	describe('Roll options', () => {
		it('should use rollMode from dialogData', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true, rollMode: 2 },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 2,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});

		it('should use default rollMode 0 when not provided in dialogData', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});

		it('should use actor.uuid when token is not available', async () => {
			mockActor.token = null;
			mockItem.actor = mockActor;
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d8',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode] };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 5 }),
			};
			MockRoll.mockImplementation(function (this: unknown) {
				return mockRoll;
			});

			const result = await manager.getData();

			expect(result.rolls).toHaveLength(1);
			expect(MockRoll).toHaveBeenCalledWith('1d8', { level: 1, strength: 10, spent: 0 }, undefined);
		});
	});

	describe('Damage effects', () => {
		it('should prevent flunky NPC damage rolls from critting', async () => {
			mockActor.type = 'npc';
			(mockActor.system as Record<string, unknown>).details = { isFlunky: true };
			mockItem.actor = mockActor;

			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 6 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d8',
				{ level: 1, strength: 10, spent: 0 },
				expect.objectContaining({
					canCrit: false,
					canMiss: true,
				}),
			);
		});

		it('should allow non-flunky NPC damage rolls to crit normally', async () => {
			mockActor.type = 'npc';
			(mockActor.system as Record<string, unknown>).details = { isFlunky: false };
			mockItem.actor = mockActor;

			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 6 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d8',
				{ level: 1, strength: 10, spent: 0 },
				expect.objectContaining({
					canCrit: true,
					canMiss: true,
				}),
			);
		});

		it('should force minion damage rolls to miss on 1 and never crit', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			mockActor.type = 'minion';
			mockItem.actor = mockActor;

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: false,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: false,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});
		it('should create DamageRoll for first damage effect', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
			expect(result.rolls![0]).toBe(mockRoll);
			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
			expect(mockRoll.evaluate).toHaveBeenCalled();
		});

		it('should use rollFormula from dialogData if provided', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 8 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			// Note: rollFormula would need to be passed through getData, but since fastForward
			// uses default dialogData, we test the node formula path
			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});

		it('should pass primaryDieValue from dialogData', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 6 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			// Note: primaryDieValue would need to be passed through dialog, but fastForward
			// uses default dialogData, so we test the default path
			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});

		it('should create regular Roll for subsequent damage effects', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const firstDamageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			const secondDamageNode: EffectNode = {
				id: 'damage-2',
				type: 'damage',
				damageType: 'cold',
				formula: '1d4',
				canCrit: false,
				canMiss: false,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [firstDamageNode, secondDamageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([firstDamageNode, secondDamageNode]);

			const mockDamageRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			const mockRegularRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 3 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockDamageRoll));
			MockRoll.mockImplementation(function MockRollImpl(this: unknown) {
				return mockRegularRoll;
			});

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(2);
			expect(result.rolls![0]).toBe(mockDamageRoll);
			expect(result.rolls![1]).toBe(mockRegularRoll);
			expect(DamageRoll).toHaveBeenCalledTimes(1);
			// MockRoll constructor captures 3 args, third is undefined since not passed by caller
			expect(MockRoll).toHaveBeenCalledWith('1d4', { level: 1, strength: 10, spent: 0 }, undefined);
		});

		it('should use default formula "0" when formula is missing', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-2',
				type: 'damage',
				damageType: 'fire',
				formula: undefined,
				canCrit: false,
				canMiss: false,
				parentContext: null,
				parentNode: null,
			} as unknown as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			// First damage node should still create DamageRoll even without formula
			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 0 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'0',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: false,
					canMiss: false,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});

		it('should leave a deferred damage node unrolled for the card to roll', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const deferredNode: EffectNode = {
				id: 'trap-damage',
				type: 'damage',
				damageType: 'necrotic',
				formula: '3d12',
				deferredRoll: true,
				canCrit: false,
				canMiss: false,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [deferredNode] };
			mockReconstructEffectsTree.mockReturnValue([deferredNode]);

			const result = await manager.getData();

			expect(result.rolls).toEqual([]);
			expect(DamageRoll).not.toHaveBeenCalled();
			expect(MockRoll).not.toHaveBeenCalled();
			expect(deferredNode).not.toHaveProperty('roll');
		});

		it('should let the next damage node claim the primary slot a deferred one skips', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const deferredNode: EffectNode = {
				id: 'trap-damage',
				type: 'damage',
				damageType: 'necrotic',
				formula: '3d12',
				deferredRoll: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			const attackNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'slashing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [deferredNode, attackNode] };
			mockReconstructEffectsTree.mockReturnValue([deferredNode, attackNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 6 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			// One DamageRoll, and it is the attack's: a skipped node must not spend
			// the crit/miss treatment the first *rolled* damage node is owed.
			expect(DamageRoll).toHaveBeenCalledTimes(1);
			expect(DamageRoll).toHaveBeenCalledWith(
				'1d8',
				{ level: 1, strength: 10, spent: 0 },
				expect.objectContaining({ canCrit: true, canMiss: true }),
			);
		});
	});

	describe('Healing effects', () => {
		it('should create regular Roll for healing effect', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d8',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([healingNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 5 }),
			};
			MockRoll.mockImplementation(function (this: unknown) {
				return mockRoll;
			});

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
			expect(result.rolls![0]).toBe(mockRoll);
			// MockRoll constructor captures 3 args, third is undefined since not passed by caller
			expect(MockRoll).toHaveBeenCalledWith('1d8', { level: 1, strength: 10, spent: 0 }, undefined);
			expect(mockRoll.evaluate).toHaveBeenCalled();
		});

		it('should use default formula "0" when healing formula is missing', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const healingNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: undefined,
				parentContext: null,
				parentNode: null,
			} as unknown as EffectNode;

			manager.activationData = { effects: [healingNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([healingNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 0 }),
			};
			MockRoll.mockImplementation(function (this: unknown) {
				return mockRoll;
			});

			await manager.getData();

			// MockRoll constructor captures 3 args, third is undefined since not passed by caller
			expect(MockRoll).toHaveBeenCalledWith('0', { level: 1, strength: 10, spent: 0 }, undefined);
		});
	});

	describe('Mixed effects', () => {
		it('should handle multiple different effect types', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d4',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode, damageNode, healingNode] };
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode, damageNode, healingNode]);

			const mockDamageRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			const mockHealingRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 3 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockDamageRoll));
			MockRoll.mockImplementation(function (this: unknown) {
				return mockHealingRoll;
			});

			const result = await manager.getData();

			// Only damage and healing create rolls; saving throws do not
			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(2);
			expect(result.rolls![0]).toBe(mockDamageRoll);
			expect(result.rolls![1]).toBe(mockHealingRoll);
			// Saving throw should not create a roll
			expect(NimbleRoll).not.toHaveBeenCalled();
		});

		it('should update activationData.effects with reconstructed tree', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it

			const updatedNode = { ...damageNode, roll: { total: 4 } };
			mockReconstructEffectsTree.mockReturnValue([updatedNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(mockReconstructEffectsTree).toHaveBeenCalled();
			expect(manager.activationData.effects).toEqual([updatedNode]);
		});
	});

	describe('Damage bonus integration', () => {
		it('should apply melee weapon damage bonus to melee weapon attacks', async () => {
			(mockActor.system as Record<string, unknown>).damageBonuses = [
				{ value: 5, damageType: 'bludgeoning', delivery: 'melee', source: 'weapon' },
			];
			mockItem.type = 'object';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'bludgeoning',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode], targets: { attackType: 'reach' } };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 10 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith('1d8 + 5', expect.anything(), expect.anything());
		});

		it('should not apply melee weapon bonus to ranged weapon attacks', async () => {
			(mockActor.system as Record<string, unknown>).damageBonuses = [
				{ value: 5, damageType: 'bludgeoning', delivery: 'melee', source: 'weapon' },
			];
			mockItem.type = 'object';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'piercing',
				formula: '1d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode], targets: { attackType: 'range' } };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 5 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith('1d8', expect.anything(), expect.anything());
		});

		it('should apply spell bonus to spell attacks but not weapon attacks', async () => {
			(mockActor.system as Record<string, unknown>).damageBonuses = [
				{ value: 3, damageType: '', delivery: 'any', source: 'spell' },
			];

			// Spell item with ranged delivery
			mockItem.type = 'spell';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '2d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode], targets: { attackType: 'range' } };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 10 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith('2d6 + 3', expect.anything(), expect.anything());
		});

		it('should apply spell bonus to melee spell (delivery=melee, source=spell)', async () => {
			(mockActor.system as Record<string, unknown>).damageBonuses = [
				{ value: 3, damageType: '', delivery: 'any', source: 'spell' },
				{ value: 5, damageType: '', delivery: 'melee', source: 'weapon' },
			];
			mockItem.type = 'spell';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'necrotic',
				formula: '2d8',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode], targets: { attackType: 'reach' } };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 12 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			// Spell bonus (+3) should apply, melee weapon bonus (+5) should NOT
			expect(DamageRoll).toHaveBeenCalledWith('2d8 + 3', expect.anything(), expect.anything());
		});

		it('should filter by damageType — lightning bonus only applies to lightning damage', async () => {
			(mockActor.system as Record<string, unknown>).damageBonuses = [
				{ value: 4, damageType: 'lightning', delivery: 'any', source: 'spell' },
			];
			mockItem.type = 'spell';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);

			const fireNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '2d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [fireNode], targets: { attackType: 'range' } };
			mockReconstructEffectsTree.mockReturnValue([fireNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 7 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			// Lightning bonus should NOT apply to fire damage
			expect(DamageRoll).toHaveBeenCalledWith('2d6', expect.anything(), expect.anything());
		});
	});

	describe('Edge cases', () => {
		it('should handle effects with no roll types (condition, note, etc.)', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const conditionNode: EffectNode = {
				id: 'condition-1',
				type: 'condition',
				condition: 'poisoned',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [conditionNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([conditionNode]);

			const result = await manager.getData();

			expect(result.rolls).toEqual([]);
			expect(NimbleRoll).not.toHaveBeenCalled();
			expect(DamageRoll).not.toHaveBeenCalled();
			expect(MockRoll).not.toHaveBeenCalled();
		});

		it('should handle damage node without canCrit and canMiss properties', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(DamageRoll).toHaveBeenCalledWith(
				'1d6',
				{ level: 1, strength: 10, spent: 0 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					isVicious: false,
				},
			);
		});
	});

	describe('Dialog routing', () => {
		beforeEach(() => {
			dialogState.result = undefined;
			keyPressStore.set({ ctrl: false, shift: false, alt: false });
		});

		/**
		 * A Roll stub that also answers `evaluateSync`, which is how the charge
		 * system resolves a consumer's cost formula while the dialog is routed.
		 */
		function stubRolls(total: number) {
			const roll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				evaluateSync: vi.fn(() => ({ total })),
				toJSON: vi.fn().mockReturnValue({ total }),
			};
			MockRoll.mockImplementation(() => roll as never);
			return roll;
		}

		/** Gives the mock item a pool and a consumer that spends a chosen amount of it. */
		function makeItemSpendVariableCharges() {
			mockItem.id = 'item-1';
			mockItem.flags = {};
			mockItem.rules = new Map<string, Record<string, unknown>>([
				[
					'0',
					{
						type: 'chargePool',
						id: 'pool-rule',
						identifier: 'focus',
						scope: 'item',
						max: '10',
						initial: 'max',
					},
				],
				[
					'1',
					{
						type: 'chargeConsumer',
						id: 'consumer-rule',
						poolIdentifier: 'focus',
						poolScope: 'item',
						costMode: 'variable',
						cost: '1',
						maxCost: '',
					},
				],
			]);
			mockActor.type = 'character';
			mockActor.flags = {};
			mockActor.system.levelUpHistory = [];
			mockActor.items = {
				contents: [mockItem],
				get: (id: string) => (mockItem.id === id ? mockItem : undefined),
			};
			// The real persist path writes the pool back through the item, so the
			// fixture needs a document update that later reads can see.
			mockItem.update = vi.fn(async (changes: Record<string, unknown>) => {
				for (const [path, value] of Object.entries(changes)) {
					foundry.utils.setProperty(mockItem, path, value);
				}
			});
		}

		/** Dice-pool writes the fixture has seen, so ordering can be asserted. */
		function dicePoolWrites(): unknown[] {
			return (mockItem.update?.mock.calls ?? []).filter((call: unknown[]) =>
				Object.hasOwn(call[0] as object, DicePoolRuleConfig.flagPath),
			);
		}

		/** Faces left in the item-scoped `fury` dice pool, read back off the fixture. */
		function readFuryFaces(): number[] | undefined {
			const pools = foundry.utils.getProperty(mockItem, DicePoolRuleConfig.flagPath) as
				| Record<string, { faces?: number[] }>
				| undefined;
			return pools?.fury?.faces;
		}

		/** Current charges of the item-scoped `focus` pool, read back off the fixture. */
		function readFocusCharges(): number | undefined {
			const pools = foundry.utils.getProperty(mockItem, ChargePoolRuleConfig.flagPath) as
				| Record<string, { current?: number }>
				| undefined;
			return pools?.focus?.current;
		}

		it('should skip the config dialog and complete activation when skipRollDialog is set', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d8',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode], skipRollDialog: true };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 5 }),
			};
			MockRoll.mockImplementation(function (this: unknown) {
				return mockRoll;
			});

			const result = await manager.getData();

			expect(result.activation).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
			expect(MockItemActivationConfigDialog).not.toHaveBeenCalled();
		});

		it('should open the config dialog when the item asks for a variable charge spend', async () => {
			// The amount spent is player input with no default, so skipRollDialog
			// cannot suppress the prompt that collects it.
			dialogState.result = { rollMode: 0 };
			makeItemSpendVariableCharges();
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '@spent',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode], skipRollDialog: true };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);
			stubRolls(1);

			await manager.getData();

			expect(MockItemActivationConfigDialog).toHaveBeenCalledTimes(1);
		});

		it('should pass the charges spent in the dialog to effect formulas as @spent', async () => {
			dialogState.result = { rollMode: 0, spentCharges: 8 };
			makeItemSpendVariableCharges();
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '@spent',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode] };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);
			stubRolls(8);

			await manager.getData();

			expect(MockRoll).toHaveBeenCalledWith(
				'@spent',
				{ level: 1, strength: 10, spent: 8 },
				undefined,
			);
		});

		it('should hold the charge spend until the caller clears the preUseItem gate', async () => {
			// getData() runs before the gate, which validates a variable consumer's
			// minimum against what is left in the pool. Spending during getData()
			// would let a full spend fail that validation and lose the charges with
			// no card, so the deduction waits for applyDeferredPoolNodes().
			dialogState.result = {
				rollMode: 0,
				spentCharges: 10,
				consumedChargePools: [{ poolId: 'focus', count: 10 }],
			};
			makeItemSpendVariableCharges();
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '@spent',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode] };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);
			stubRolls(10);

			await manager.getData();

			expect(readFocusCharges()).toBeUndefined();
			expect(manager.chargeConsumption).toEqual([]);

			await manager.applyDeferredPoolNodes();

			expect(readFocusCharges()).toBe(0);
			expect(manager.chargeConsumption).toEqual([
				expect.objectContaining({ previousValue: 10, currentValue: 0, change: -10 }),
			]);
		});

		it('should cap @spent at what the pool actually holds', async () => {
			// The dialog clamps against a snapshot from when it opened, so a pool that
			// moved underneath it could otherwise heal for more than it can pay.
			dialogState.result = { rollMode: 0, spentCharges: 40 };
			makeItemSpendVariableCharges();
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '@spent',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode] };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);
			stubRolls(10);

			await manager.getData();

			// The pool's max, not the 40 the dialog claimed.
			expect(MockRoll).toHaveBeenCalledWith(
				'@spent',
				{ level: 1, strength: 10, spent: 10 },
				undefined,
			);
		});

		it('should hold spent pool dice until the caller clears the preUseItem gate', async () => {
			// Same reason as the charge spend: the gate can still refuse the use over
			// its charge cost, and a refused use must not have eaten the dice.
			makeItemSpendVariableCharges();
			// The rule defines the pool, the stored flag holds the rolled faces; the
			// spend needs both, since the write resolves the pool from the definitions.
			mockItem.rules!.set('2', {
				type: 'dicePool',
				id: 'fury-pool',
				identifier: 'fury',
				label: 'Fury Dice',
				scope: 'item',
				dieSize: 'd6',
				max: '3',
				initial: 'zero',
			});
			foundry.utils.setProperty(mockItem, `${DicePoolRuleConfig.flagPath}.fury`, {
				identifier: 'fury',
				label: 'Fury Dice',
				dieSize: 'd6',
				max: 3,
				faces: [4, 5, 6],
			});
			dialogState.result = {
				rollMode: 0,
				spentCharges: 1,
				consumedPoolDice: [{ poolId: 'fury', faceIndex: 1 }],
			};
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			manager.activationData = { effects: [] };
			mockReconstructEffectsTree.mockReturnValue([]);

			await manager.getData();

			expect(readFuryFaces(), 'the dice are untouched before the gate').toEqual([4, 5, 6]);
			expect(dicePoolWrites(), 'writes before the gate').toHaveLength(0);

			await manager.applyDeferredPoolNodes();

			expect(dicePoolWrites(), 'writes after the gate').toHaveLength(1);
		});

		it('should refuse the use when two variable consumers share one pool', async () => {
			// The dialog renders one prompt per pool, so a second variable consumer
			// on the same pool has no amount of its own. Refused before the dialog
			// opens, which is what would otherwise collide.
			makeItemSpendVariableCharges();
			mockItem.rules!.set('2', {
				type: 'chargeConsumer',
				id: 'second-consumer',
				poolIdentifier: 'focus',
				poolScope: 'item',
				costMode: 'variable',
				cost: '1',
				maxCost: '',
			});
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			manager.activationData = { effects: [] };
			mockReconstructEffectsTree.mockReturnValue([]);

			const result = await manager.getData();

			expect(result).toEqual({ activation: null, rolls: null });
			expect(MockItemActivationConfigDialog).not.toHaveBeenCalled();
			expect(readFocusCharges()).toBeUndefined();
		});

		it('should leave the pool to the table when spending automation is off', async () => {
			// The prompt still runs: the amount feeds the item's own effect formulas,
			// so suppressing it would heal for nothing rather than hand the GM a count.
			const gameGlobal = globalThis as unknown as { game: { settings?: unknown } };
			const realSettings = gameGlobal.game.settings;
			gameGlobal.game.settings = {
				get: (_namespace: string, key: string) => key !== 'automation.resourceSpending',
			};

			try {
				dialogState.result = {
					rollMode: 0,
					spentCharges: 4,
					consumedChargePools: [{ poolId: 'focus', count: 4 }],
				};
				makeItemSpendVariableCharges();
				manager = new ItemActivationManager(
					mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
					{},
				);
				const healingNode: EffectNode = {
					id: 'healing-1',
					type: 'healing',
					healingType: 'healing',
					formula: '@spent',
					parentContext: null,
					parentNode: null,
				} as EffectNode;

				manager.activationData = { effects: [healingNode] };
				mockReconstructEffectsTree.mockReturnValue([healingNode]);
				stubRolls(4);

				await manager.getData();
				await manager.applyDeferredPoolNodes();

				expect(MockRoll).toHaveBeenCalledWith(
					'@spent',
					{ level: 1, strength: 10, spent: 4 },
					undefined,
				);
				expect(readFocusCharges()).toBeUndefined();
				expect(manager.chargeConsumption).toEqual([]);
			} finally {
				gameGlobal.game.settings = realSettings;
			}
		});

		it('should skip the upcast dialog and activate at base tier when skipRollDialog is set on a spell', async () => {
			mockItem.type = 'spell';
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);

			manager.activationData = { effects: [], skipRollDialog: true };
			mockReconstructEffectsTree.mockReturnValue([]);

			const result = await manager.getData();

			expect(MockSpellUpcastDialog).not.toHaveBeenCalled();
			expect(MockItemActivationConfigDialog).not.toHaveBeenCalled();
			expect(result.activation).not.toBeNull();
			// No upcast was applied, so the spell activated at its base tier.
			expect(manager.upcastResult).toBeNull();
		});

		it('should open the config dialog when skipRollDialog is unset and the item has rolls', async () => {
			dialogState.result = { rollMode: 0 };
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			const result = await manager.getData();

			expect(MockItemActivationConfigDialog).toHaveBeenCalledTimes(1);
			expect(result.activation).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
		});

		it('should return null activation and rolls when the config dialog is cancelled', async () => {
			dialogState.result = null;
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const result = await manager.getData();

			expect(MockItemActivationConfigDialog).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ activation: null, rolls: null });
			expect(DamageRoll).not.toHaveBeenCalled();
		});

		it('should open the config dialog when Alt is held and skipRollDialog is set', async () => {
			keyPressStore.set({ ctrl: false, shift: false, alt: true });
			dialogState.result = { rollMode: 0 };
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const healingNode: EffectNode = {
				id: 'healing-1',
				type: 'healing',
				healingType: 'healing',
				formula: '1d8',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [healingNode], skipRollDialog: true };
			mockReconstructEffectsTree.mockReturnValue([healingNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 5 }),
			};
			MockRoll.mockImplementation(function (this: unknown) {
				return mockRoll;
			});

			const result = await manager.getData();

			// Alt inverts the item's dialog default, forcing the dialog open.
			expect(MockItemActivationConfigDialog).toHaveBeenCalledTimes(1);
			expect(result.activation).not.toBeNull();
		});

		it('should skip the config dialog when Alt is held and skipRollDialog is unset', async () => {
			keyPressStore.set({ ctrl: false, shift: false, alt: true });
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{},
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode] };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			const result = await manager.getData();

			expect(MockItemActivationConfigDialog).not.toHaveBeenCalled();
			expect(result.activation).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
		});

		it('should prefer fastForward options over skipRollDialog defaults when both are set', async () => {
			manager = new ItemActivationManager(
				mockItem as unknown as ConstructorParameters<typeof ItemActivationManager>[0],
				{ fastForward: true, rollFormula: '3d12', rollHidden: true },
			);
			const damageNode: EffectNode = {
				id: 'damage-1',
				type: 'damage',
				damageType: 'fire',
				formula: '1d6',
				canCrit: true,
				canMiss: true,
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [damageNode], skipRollDialog: true };
			mockReconstructEffectsTree.mockReturnValue([damageNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 20 }),
			};
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			const result = await manager.getData();

			expect(MockItemActivationConfigDialog).not.toHaveBeenCalled();
			// The fastForward rollFormula overrides the node formula; the
			// skipRollDialog default dialog data would have used '1d6'.
			expect(DamageRoll).toHaveBeenCalledWith('3d12', expect.anything(), expect.anything());
			// rollHidden only flows through the fastForward dialog data build.
			expect(result.rollHidden).toBe(true);
		});
	});
});
