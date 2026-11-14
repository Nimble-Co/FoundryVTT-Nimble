import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConditionalBonusRule } from '../conditionalBonus.js';

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

	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
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

		it('puts the stacks of its effect into a dice formula', () => {
			const rule = createRule({ damageBonus: '(@stacks)d6' }, createMockActor());
			Object.defineProperty(rule, 'stacks', { get: () => 2, configurable: true });
			expect(rule.resolveDamage()).toEqual({ value: null, formula: '(2)d6' });
		});

		it('returns nulls when no damage is offered', () => {
			const rule = createRule({ damageBonus: '' }, createMockActor());
			expect(rule.resolveDamage()).toEqual({ value: null, formula: null });
		});
	});

	describe('damage of an item', () => {
		const spirit = (formula = '1d6+@will', damageType = 'radiant') => ({
			name: 'Lifebinding Spirit',
			system: {
				identifier: 'lifebinding-spirit',
				activation: {
					effects: [
						{ id: 'save', type: 'savingThrow', parentContext: null, parentNode: null },
						{
							id: 'dmg',
							type: 'damage',
							formula,
							damageType,
							parentContext: null,
							parentNode: null,
						},
						{
							id: 'dmg2',
							type: 'damage',
							formula: '1',
							damageType: 'fire',
							parentContext: null,
							parentNode: null,
						},
					],
				},
			},
		});
		const roll = Roll as unknown as { replaceFormulaData?: unknown };
		let ownReplace: unknown;
		beforeEach(() => {
			ownReplace = roll.replaceFormulaData;
			roll.replaceFormulaData = (formula: string, data: Record<string, unknown>) =>
				formula.replace(/@(\w+)/g, (_: string, key: string) => String(data[key] ?? 0));
		});
		afterEach(() => {
			roll.replaceFormulaData = ownReplace;
		});

		function assist(items: object[]) {
			const actor = Object.assign(createMockActor({ will: 3 }), { items });
			const rule = createRule({ advantage: 0, damageBonus: '' }, actor);
			Object.assign(rule, { damageOfItem: 'lifebinding-spirit' });
			return rule;
		}

		it('offers the first damage step of the named item, with its type and the numbers of the attacker', () => {
			const rule = assist([{ name: 'Mace', system: { identifier: 'mace' } }, spirit()]);

			expect(rule.offersDamage()).toBe(true);
			expect(rule.resolveDamage()).toEqual({
				value: null,
				formula: '1d6+3',
				damageType: 'radiant',
				fromItemIdentifier: 'lifebinding-spirit',
			});
		});

		it('resolves an item damage with no dice to a number', () => {
			const rule = assist([spirit('2 + @will')]);

			expect(rule.resolveDamage()).toMatchObject({
				value: 5,
				formula: null,
				damageType: 'radiant',
			});
		});

		it('offers nothing when the creature has no such item, or the item deals no damage', () => {
			const none = assist([{ name: 'Mace', system: { identifier: 'mace' } }]);
			const noDamage = assist([
				{
					name: 'Spirit',
					system: { identifier: 'lifebinding-spirit', activation: { effects: [] } },
				},
			]);

			for (const rule of [none, noDamage]) {
				expect(rule.offersDamage()).toBe(false);
				expect(rule.resolveDamage()).toEqual({ value: null, formula: null });
			}
		});

		it('starts chosen unless the rule says otherwise', () => {
			const rule = createRule({}, createMockActor());
			expect(rule.startsChosen).not.toBe(false);
			const schema = ConditionalBonusRule.defineSchema();
			expect(schema.startsChosen.options).toMatchObject({ initial: true, nullable: false });
			expect(schema.damageOfItem.options).toMatchObject({ initial: '', blank: true });
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and description key', () => {
			expect(ConditionalBonusRule.group).toBe('bonuses');
			expect(ConditionalBonusRule.description).toBe('NIMBLE.rules.conditionalBonus.description');
		});
	});
});
