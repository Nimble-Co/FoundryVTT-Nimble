import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DicePoolEntry, PoolMode } from './dicePool.js';
import { DicePoolRule } from './dicePool.js';

interface MockActor {
	dicePools?: Record<string, DicePoolEntry>;
	getRollData: Mock<() => Record<string, unknown>>;
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
}

interface RuleSourceData {
	type: string;
	id: string;
	identifier: string;
	label: string;
	faces: number;
	quantity: string;
	poolMode: PoolMode;
	levels: Record<string, { faces: number; quantity: string }>;
	disabled: boolean;
	priority: number;
	predicate: Record<string, unknown>;
}

interface DicePoolRuleTestInstance extends DicePoolRule {
	identifier: string;
	label: string;
	faces: number;
	quantity: string;
	poolMode: PoolMode;
	levels: Record<string, { faces: number; quantity: string }>;
	disabled: boolean;
}

function createMockActor(level = 1): MockActor {
	return {
		getRollData: vi.fn(() => ({ level })),
	};
}

function createMockItem(actor: MockActor, isEmbedded = true): MockItem {
	return { isEmbedded, actor, name: 'Test Feature', uuid: 'test-uuid' };
}

function createDicePoolRule(
	config: {
		identifier: string;
		label?: string;
		faces?: number;
		quantity?: string;
		poolMode?: PoolMode;
		levels?: Record<string, { faces?: number; quantity?: string }>;
		disabled?: boolean;
	},
	actor: MockActor,
	options: { isEmbedded?: boolean } = {},
): DicePoolRuleTestInstance {
	const item = createMockItem(actor, options.isEmbedded ?? true);

	const fullLevels: Record<string, { faces: number; quantity: string }> = {};
	for (let i = 1; i <= 20; i++) {
		const override = config.levels?.[i];
		fullLevels[i] = { faces: override?.faces ?? 0, quantity: override?.quantity ?? '' };
	}

	const source: RuleSourceData = {
		type: 'dicePool',
		id: 'test-rule-id',
		identifier: config.identifier,
		label: config.label ?? config.identifier,
		faces: config.faces ?? 6,
		quantity: config.quantity ?? '1',
		poolMode: config.poolMode ?? 'resource',
		levels: fullLevels,
		disabled: config.disabled ?? false,
		priority: 1,
		predicate: {},
	};

	const rule = new DicePoolRule(
		source as foundry.data.fields.SchemaField.CreateData<DicePoolRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as DicePoolRuleTestInstance;

	rule.identifier = config.identifier;
	rule.label = config.label ?? config.identifier;
	rule.faces = config.faces ?? 6;
	rule.quantity = config.quantity ?? '1';
	rule.poolMode = config.poolMode ?? 'resource';
	rule.levels = fullLevels;
	rule.disabled = config.disabled ?? false;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, '_predicate', {
		get: () => ({ size: 0 }),
		configurable: true,
	});

	return rule;
}

describe('DicePoolRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('registers a pool on actor.dicePools', () => {
			const actor = createMockActor(1);
			const rule = createDicePoolRule(
				{ identifier: 'fury-dice', label: 'Fury Dice', faces: 4, quantity: '1' },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools).toBeDefined();
			expect(actor.dicePools!['fury-dice']).toEqual({
				identifier: 'fury-dice',
				label: 'Fury Dice',
				faces: 4,
				max: 1,
				poolMode: 'resource',
			});
		});

		it('accumulates multiple pools from different rules', () => {
			const actor = createMockActor(1);
			const ruleA = createDicePoolRule({ identifier: 'fury-dice', faces: 4 }, actor);
			const ruleB = createDicePoolRule({ identifier: 'combat-dice', faces: 8 }, actor);

			ruleA.afterPrepareData();
			ruleB.afterPrepareData();

			expect(Object.keys(actor.dicePools!)).toHaveLength(2);
			expect(actor.dicePools!['fury-dice'].faces).toBe(4);
			expect(actor.dicePools!['combat-dice'].faces).toBe(8);
		});

		it('does nothing when item is not embedded', () => {
			const actor = createMockActor(1);
			const rule = createDicePoolRule({ identifier: 'fury-dice' }, actor, { isEmbedded: false });

			rule.afterPrepareData();

			expect(actor.dicePools).toBeUndefined();
		});

		it('does nothing when identifier is empty', () => {
			const actor = createMockActor(1);
			const rule = createDicePoolRule({ identifier: '' }, actor);

			rule.afterPrepareData();

			expect(actor.dicePools).toBeUndefined();
		});
	});

	describe('level overrides', () => {
		it('upgrades die faces at a threshold level', () => {
			const actor = createMockActor(9);
			const rule = createDicePoolRule(
				{
					identifier: 'combat-dice',
					faces: 8,
					quantity: '1',
					levels: { '9': { faces: 10 } },
				},
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools!['combat-dice'].faces).toBe(10);
		});

		it('keeps base faces when level is below threshold', () => {
			const actor = createMockActor(5);
			const rule = createDicePoolRule(
				{
					identifier: 'combat-dice',
					faces: 8,
					levels: { '9': { faces: 10 } },
				},
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools!['combat-dice'].faces).toBe(8);
		});

		it('upgrades quantity at a threshold level', () => {
			const actor = createMockActor(5);
			const rule = createDicePoolRule(
				{
					identifier: 'fury-dice',
					faces: 4,
					quantity: '1',
					levels: { '5': { quantity: '2' } },
				},
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools!['fury-dice'].max).toBe(2);
		});

		it('applies the highest applicable level override', () => {
			const actor = createMockActor(13);
			const rule = createDicePoolRule(
				{
					identifier: 'combat-dice',
					faces: 8,
					levels: { '9': { faces: 10 }, '13': { faces: 12 }, '17': { faces: 20 } },
				},
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools!['combat-dice'].faces).toBe(12);
		});

		it('applies multiple level overrides cumulatively', () => {
			const actor = createMockActor(14);
			const rule = createDicePoolRule(
				{
					identifier: 'judgment-dice',
					faces: 6,
					quantity: '2',
					levels: { '3': { faces: 8 }, '14': { quantity: '3' } },
				},
				actor,
			);

			rule.afterPrepareData();

			expect(actor.dicePools!['judgment-dice'].faces).toBe(8);
			expect(actor.dicePools!['judgment-dice'].max).toBe(3);
		});
	});

	describe('schema', () => {
		it('defines the required schema fields', () => {
			const schemaDef = DicePoolRule.defineSchema();

			expect(schemaDef).toHaveProperty('identifier');
			expect(schemaDef).toHaveProperty('label');
			expect(schemaDef).toHaveProperty('faces');
			expect(schemaDef).toHaveProperty('quantity');
			expect(schemaDef).toHaveProperty('levels');
			expect(schemaDef).toHaveProperty('type');
		});
	});
});
