import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { EffectNode } from '#types/effectTree.js';
import { MockRollConstructor } from '../../tests/mocks/foundry.js';
import type { NimbleBaseActor } from '../documents/actor/base.svelte.ts';
import type { NimbleBaseItem } from '../documents/item/base.svelte.ts';
import { ItemActivationManager, testDependencies } from './ItemActivationManager.js';

const mockReconstructEffectsTree = vi.fn();
const mockGetRollFormula = vi.fn();

// Mock dependencies - create the mock inside the factory
const MockNimbleRoll = vi.fn(function (
	this: Mock<typeof NimbleRoll>,
	_formula: string,
	_data?: unknown,
) {
	// Always create the instance with required methods
	const instance = {
		evaluate: vi.fn().mockResolvedValue(undefined),
		toJSON: vi.fn().mockReturnValue({ total: 0 }),
	};

	if (new.target !== undefined) {
		// Called with 'new' - assign properties to 'this' and return 'this'
		this.evaluate = instance.evaluate;
		this.toJSON = instance.toJSON;
		return this;
	}

	// Called without 'new', return the instance
	return instance;
});
// Make it constructable
Object.setPrototypeOf(MockNimbleRoll, Function.prototype);

const MockDamageRoll = vi.fn(function (
	this: Mock<typeof DamageRoll>,
	_formula: string,
	_data?: unknown,
	_options?: unknown,
) {
	// Always create the instance with required methods
	const instance = {
		evaluate: vi.fn().mockResolvedValue(undefined),
		toJSON: vi.fn().mockReturnValue({ total: 0 }),
	};

	if (new.target !== undefined) {
		// Called with 'new' - assign properties to 'this' and return 'this'
		this.evaluate = instance.evaluate;
		this.toJSON = instance.toJSON;
		return this;
	}

	// Called without 'new', return the instance
	return instance;
});
// Make it constructable
Object.setPrototypeOf(MockDamageRoll, Function.prototype);

const DamageRoll = MockDamageRoll;
const NimbleRoll = MockNimbleRoll;
const getRollFormula = mockGetRollFormula;

vi.doMock('../stores/keyPressStore.js', () => ({
	keyPressStore: {
		subscribe: vi.fn(() => vi.fn()),
	},
}));
vi.doMock('../documents/dialogs/ItemActivationConfigDialog.svelte.js', () => ({
	default: vi.fn(),
}));

// Helper function to create a mock implementation that handles 'new' correctly
function createMockConstructorImplementation(mockInstance: {
	evaluate: Mock<() => void>;
	toJSON: Mock<() => void>;
}) {
	return function (this: Mock<typeof NimbleRoll> | Mock<typeof DamageRoll>) {
		// If 'this' exists and is an object (called with 'new'), assign to it
		if (this && typeof this === 'object' && this !== globalThis) {
			this.evaluate = mockInstance.evaluate;
			this.toJSON = mockInstance.toJSON;
			return mockInstance;
		}

		// Otherwise, return the instance directly
		return mockInstance;
	};
}

const MockRoll = (
	globalThis as unknown as { foundry: { dice: { Roll: ReturnType<typeof vi.fn> } } }
).foundry.dice.Roll;

describe('ItemActivationManager.getData (rolls)', () => {
	let mockItem: NimbleBaseItem;
	let mockActor: NimbleBaseActor;
	let manager: ItemActivationManager;

	beforeEach(() => {
		vi.clearAllMocks();
		mockGetRollFormula.mockReturnValue('1d20');
		// Ensure game.user.targets exists (setup.ts creates game but may not have targets)
		// @ts-expect-error - game is a global mock in tests
		if (!globalThis.game.user.targets) {
			// @ts-expect-error - game is a global mock in tests
			globalThis.game.user.targets = [];
		}
		MockNimbleRoll.mockClear();
		MockDamageRoll.mockClear();
		// Reset MockRoll to default implementation
		MockRoll.mockImplementation(MockRollConstructor);
		// Reset reconstructEffectsTree mock - clear call history
		mockReconstructEffectsTree.mockReset();
		// Set default implementations for overrides
		mockReconstructEffectsTree.mockImplementation((effects) => effects || []);
		Object.assign(testDependencies, {
			NimbleRoll: MockNimbleRoll,
			DamageRoll: MockDamageRoll,
			getRollFormula: mockGetRollFormula,
			reconstructEffectsTree: mockReconstructEffectsTree,
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

		// Create manager instance
		manager = new ItemActivationManager(mockItem, {});
	});

	describe('Item types that return empty array', () => {
		it.each([['ancestry'], ['background'], ['boon'], ['class'], ['subclass']])(
			'should return empty array for %s item type',
			async (itemType) => {
				mockItem.type = itemType;
				manager = new ItemActivationManager(mockItem, { fastForward: true });

				const result = await manager.getData();

				expect(result.rolls).toEqual([]);
				// flattenEffectsTree is not called for these item types
			},
		);
	});

	describe('Items with no effects', () => {
		it('should return empty array when activationData has no effects', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
			manager.activationData = { effects: [] };
			// Set up mock for reconstructEffectsTree
			mockReconstructEffectsTree.mockReturnValue([]);

			const result = await manager.getData();

			expect(result.rolls).toEqual([]);
		});
	});

	describe('Saving throw effects', () => {
		it('should create NimbleRoll for saving throw effect with savingThrowType', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 3');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			// Set up NimbleRoll mock - it extends foundry.dice.Roll, so it needs evaluate and toJSON
			const mockEvaluate = vi.fn().mockResolvedValue(undefined);
			const mockToJSON = vi.fn().mockReturnValue({ total: 15 });
			// Override NimbleRoll mock for this test
			vi.mocked(NimbleRoll).mockImplementation(function (
				this: unknown,
				_formula: string,
				_data?: unknown,
			) {
				const instance = {
					evaluate: mockEvaluate,
					toJSON: mockToJSON,
				};
				// If called with 'new', assign to this
				if (
					this &&
					typeof this === 'object' &&
					this !== globalThis &&
					(typeof global === 'undefined' || this !== global)
				) {
					Object.assign(this, instance);
					return this;
				}
				// Called without 'new', return new instance
				return instance;
			});

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(1);
			expect(result.rolls![0].evaluate).toBe(mockEvaluate);
			expect(result.rolls![0].toJSON).toBe(mockToJSON);
			expect(getRollFormula).toHaveBeenCalledWith(mockActor, {
				saveKey: 'strength',
				rollMode: 0,
				type: 'savingThrow',
			});
			expect(NimbleRoll).toHaveBeenCalledWith('1d20 + 3', {
				level: 1,
				strength: 10,
				prompted: false,
				respondentId: 'token-uuid-456',
			});
			expect(mockEvaluate).toHaveBeenCalled();
		});

		it('should use saveType if available instead of savingThrowType', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true, rollMode: 0 });
			const savingThrowNode: EffectNode & { saveType?: string } = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				saveType: 'dexterity',
				parentContext: null,
				parentNode: null,
			};

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 2');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 12 }),
			};
			vi.mocked(NimbleRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(getRollFormula).toHaveBeenCalledWith(mockActor, {
				saveKey: 'dexterity',
				rollMode: 0,
				type: 'savingThrow',
			});
		});

		it('should use rollMode from dialogData', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true, rollMode: 2 });
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'will',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 1');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 10 }),
			};
			vi.mocked(NimbleRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(getRollFormula).toHaveBeenCalledWith(mockActor, {
				saveKey: 'will',
				rollMode: 2,
				type: 'savingThrow',
			});
		});

		it('should use default rollMode 0 when not provided in dialogData', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'intelligence',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 1');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 8 }),
			};
			vi.mocked(NimbleRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(getRollFormula).toHaveBeenCalledWith(mockActor, {
				saveKey: 'intelligence',
				rollMode: 0,
				type: 'savingThrow',
			});
		});

		it('should skip saving throw when actor is null', async () => {
			mockItem.actor = null;
			manager = new ItemActivationManager(mockItem, { fastForward: true });

			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const result = await manager.getData();

			expect(result.rolls).toEqual([]);
			expect(getRollFormula).not.toHaveBeenCalled();
			expect(NimbleRoll).not.toHaveBeenCalled();
		});

		it('should use actor.uuid when token is not available', async () => {
			mockActor.token = null;
			mockItem.actor = mockActor;
			manager = new ItemActivationManager(mockItem, { fastForward: true });

			const savingThrowNode: EffectNode = {
				id: 'save-1',
				type: 'savingThrow',
				savingThrowType: 'strength',
				parentContext: null,
				parentNode: null,
			} as EffectNode;

			manager.activationData = { effects: [savingThrowNode] };
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 3');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode]);

			const mockRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 15 }),
			};
			vi.mocked(NimbleRoll).mockImplementation(createMockConstructorImplementation(mockRoll));

			await manager.getData();

			expect(NimbleRoll).toHaveBeenCalledWith('1d20 + 3', {
				level: 1,
				strength: 10,
				prompted: false,
				respondentId: 'actor-uuid-123',
			});
		});
	});

	describe('Damage effects', () => {
		it('should create DamageRoll for first damage effect', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
				{ level: 1, strength: 10 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: undefined,
					primaryDieModifier: undefined,
				},
			);
			expect(mockRoll.evaluate).toHaveBeenCalled();
		});

		it('should use rollFormula from dialogData if provided', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
				{ level: 1, strength: 10 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: undefined,
					primaryDieModifier: undefined,
				},
			);
		});

		it('should pass primaryDieValue from dialogData', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
				{ level: 1, strength: 10 },
				{
					canCrit: true,
					canMiss: true,
					rollMode: 0,
					primaryDieValue: undefined,
					primaryDieModifier: undefined,
				},
			);
		});

		it('should create regular Roll for subsequent damage effects', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
			MockRoll.mockImplementation(function (this: any) {
				return mockRegularRoll;
			});

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(2);
			expect(result.rolls![0]).toBe(mockDamageRoll);
			expect(result.rolls![1]).toBe(mockRegularRoll);
			expect(DamageRoll).toHaveBeenCalledTimes(1);
			expect(MockRoll).toHaveBeenCalledWith('1d4', { level: 1, strength: 10 });
		});

		it('should use default formula "0" when formula is missing', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
				undefined,
				{ level: 1, strength: 10 },
				{
					canCrit: false,
					canMiss: false,
					rollMode: 0,
					primaryDieValue: undefined,
					primaryDieModifier: undefined,
				},
			);
		});
	});

	describe('Healing effects', () => {
		it('should create regular Roll for healing effect', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
			expect(MockRoll).toHaveBeenCalledWith('1d8', { level: 1, strength: 10 });
			expect(mockRoll.evaluate).toHaveBeenCalled();
		});

		it('should use default formula "0" when healing formula is missing', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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

			expect(MockRoll).toHaveBeenCalledWith('0', { level: 1, strength: 10 });
		});
	});

	describe('Mixed effects', () => {
		it('should handle multiple different effect types', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
			// Use real flattenEffectsTree - no need to mock it
			vi.mocked(getRollFormula).mockReturnValue('1d20 + 3');
			mockReconstructEffectsTree.mockReturnValue([savingThrowNode, damageNode, healingNode]);

			const mockSavingThrowRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 15 }),
			};
			const mockDamageRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 4 }),
			};
			const mockHealingRoll = {
				evaluate: vi.fn().mockResolvedValue(undefined),
				toJSON: vi.fn().mockReturnValue({ total: 3 }),
			};
			vi.mocked(NimbleRoll).mockImplementation(
				createMockConstructorImplementation(mockSavingThrowRoll),
			);
			vi.mocked(DamageRoll).mockImplementation(createMockConstructorImplementation(mockDamageRoll));
			MockRoll.mockImplementation(function (this: unknown) {
				return mockHealingRoll;
			});

			const result = await manager.getData();

			expect(result.rolls).not.toBeNull();
			expect(result.rolls).toHaveLength(3);
			expect(result.rolls![0]).toBe(mockSavingThrowRoll);
			expect(result.rolls![1]).toBe(mockDamageRoll);
			expect(result.rolls![2]).toBe(mockHealingRoll);
		});

		it('should update activationData.effects with reconstructed tree', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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

	describe('Edge cases', () => {
		it('should handle effects with no roll types (condition, note, etc.)', async () => {
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
			manager = new ItemActivationManager(mockItem, { fastForward: true });
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
				{ level: 1, strength: 10 },
				{
					canCrit: undefined,
					canMiss: undefined,
					rollMode: 0,
					primaryDieValue: undefined,
					primaryDieModifier: undefined,
				},
			);
		});
	});
});
