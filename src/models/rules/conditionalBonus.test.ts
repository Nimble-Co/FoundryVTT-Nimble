import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionalBonusRule } from './conditionalBonus.js';

interface MockActor {
	getRollData: ReturnType<typeof vi.fn>;
}

function createMockActor(rollData: Record<string, unknown> = { level: 5 }): MockActor {
	return { getRollData: vi.fn(() => rollData) };
}

interface FakePredicate {
	size: number;
	test: (domain: Set<string>) => boolean;
}

function createRule(
	config: {
		advantage?: number;
		damageBonus?: string;
		damageType?: string;
		delivery?: 'melee' | 'ranged' | 'any';
		source?: 'weapon' | 'spell' | 'any';
		targetCondition?: FakePredicate;
		disabled?: boolean;
	},
	actor: MockActor,
): ConditionalBonusRule {
	const item = { isEmbedded: true, actor, name: "Hunter's Mark", uuid: 'item-uuid' };
	const sourceData = {
		advantage: config.advantage ?? 1,
		damageBonus: config.damageBonus ?? '@level',
		damageType: config.damageType ?? '',
		delivery: config.delivery ?? 'any',
		source: config.source ?? 'any',
		disabled: config.disabled ?? false,
		label: "Hunter's Mark",
		id: 'rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'conditionalBonus',
	};

	const rule = new ConditionalBonusRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			ConditionalBonusRule['schema']['fields']
		>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	rule.advantage = config.advantage ?? 1;
	rule.damageBonus = config.damageBonus ?? '@level';
	rule.delivery = config.delivery ?? 'any';
	rule.source = config.source ?? 'any';
	(rule as unknown as { damageType: string }).damageType = config.damageType ?? '';
	rule.disabled = config.disabled ?? false;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, '_predicate', { get: () => ({ size: 0 }), configurable: true });
	Object.defineProperty(rule, 'targetCondition', {
		get: () => config.targetCondition ?? { size: 0, test: () => true },
		configurable: true,
	});

	return rule;
}

describe('ConditionalBonusRule', () => {
	beforeEach(() => vi.clearAllMocks());

	describe('offer detection', () => {
		it('offers advantage when advantage > 0', () => {
			const rule = createRule({ advantage: 1 }, createMockActor());
			expect(rule.offersAdvantage()).toBe(true);
		});

		it('does not offer advantage when advantage is 0', () => {
			const rule = createRule({ advantage: 0 }, createMockActor());
			expect(rule.offersAdvantage()).toBe(false);
		});

		it('offers damage when a non-empty formula is set', () => {
			expect(createRule({ damageBonus: '@level' }, createMockActor()).offersDamage()).toBe(true);
			expect(createRule({ damageBonus: '1d6' }, createMockActor()).offersDamage()).toBe(true);
		});

		it('does not offer damage for empty or zero formulas', () => {
			expect(createRule({ damageBonus: '' }, createMockActor()).offersDamage()).toBe(false);
			expect(createRule({ damageBonus: '0' }, createMockActor()).offersDamage()).toBe(false);
		});
	});

	describe('matchesAttack', () => {
		it('rejects when there is no attack delivery', () => {
			const rule = createRule({ delivery: 'any', source: 'any' }, createMockActor());
			expect(rule.matchesAttack(null, 'weapon')).toBe(false);
		});

		it('matches when delivery and source are "any"', () => {
			const rule = createRule({ delivery: 'any', source: 'any' }, createMockActor());
			expect(rule.matchesAttack('ranged', 'weapon')).toBe(true);
		});

		it('respects a specific delivery restriction', () => {
			const rule = createRule({ delivery: 'ranged' }, createMockActor());
			expect(rule.matchesAttack('ranged', 'weapon')).toBe(true);
			expect(rule.matchesAttack('melee', 'weapon')).toBe(false);
		});

		it('respects a specific source restriction', () => {
			const rule = createRule({ source: 'spell' }, createMockActor());
			expect(rule.matchesAttack('melee', 'spell')).toBe(true);
			expect(rule.matchesAttack('melee', 'weapon')).toBe(false);
		});
	});

	describe('matchesTarget', () => {
		it('always matches with an empty target condition', () => {
			const rule = createRule({}, createMockActor());
			expect(rule.matchesTarget(undefined)).toBe(true);
		});

		it('evaluates a non-empty target condition against the domain', () => {
			const predicate: FakePredicate = {
				size: 1,
				test: (domain) => domain.has('target:quarry'),
			};
			const rule = createRule({ targetCondition: predicate }, createMockActor());
			expect(rule.matchesTarget(new Set(['target:quarry']))).toBe(true);
			expect(rule.matchesTarget(new Set(['target:bloodied']))).toBe(false);
			expect(rule.matchesTarget(undefined)).toBe(false);
		});
	});

	describe('resolveDamage', () => {
		it('resolves a numeric formula to a value', () => {
			const rule = createRule({ damageBonus: '@level' }, createMockActor({ level: 7 }));
			expect(rule.resolveDamage()).toEqual({ value: 7, formula: null });
		});

		it('keeps a dice formula as a raw string', () => {
			const rule = createRule({ damageBonus: '1d6' }, createMockActor());
			expect(rule.resolveDamage()).toEqual({ value: null, formula: '1d6' });
		});

		it('returns nulls when no damage is offered', () => {
			const rule = createRule({ damageBonus: '' }, createMockActor());
			expect(rule.resolveDamage()).toEqual({ value: null, formula: null });
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and description key', () => {
			expect(ConditionalBonusRule.group).toBe('bonuses');
			expect(ConditionalBonusRule.description).toBe('NIMBLE.rules.conditionalBonus.description');
		});
	});
});
