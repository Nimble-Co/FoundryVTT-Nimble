import { describe, expect, it, vi } from 'vitest';
import { buildTargetDomain, getActiveConditionalBonuses } from './conditionalBonuses.js';

// getActiveConditionalBonuses drives real ConditionalBonusRule instances in production,
// but its own logic (delivery/source inference, the filter chain, the label fallback)
// only depends on the rule's public predicate methods — so lightweight fakes isolate it.
function createRule(overrides: Record<string, unknown> = {}) {
	return {
		type: 'conditionalBonus',
		id: 'rule-id',
		label: 'Quarry',
		item: { name: "Hunter's Mark" },
		advantage: 1,
		damageType: '',
		appliesTo: vi.fn(() => true),
		matchesAttack: vi.fn(() => true),
		matchesTarget: vi.fn(() => true),
		offersAdvantage: vi.fn(() => true),
		offersDamage: vi.fn(() => false),
		resolveDamage: vi.fn(() => ({ value: null, formula: null })),
		...overrides,
	};
}

function createAttacker(rules: unknown[]) {
	return { rules, getFlag: () => ({}) };
}

const weaponItem = { type: 'weapon', system: { activation: { targets: { attackType: 'reach' } } } };

describe('conditionalBonuses', () => {
	describe('getActiveConditionalBonuses — delivery/source inference', () => {
		it('maps a reach attack to melee delivery', () => {
			const rule = createRule();
			getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined);
			expect(rule.matchesAttack).toHaveBeenCalledWith('melee', 'weapon');
		});

		it('maps a ranged attack to ranged delivery', () => {
			const rule = createRule();
			const item = { type: 'weapon', system: { activation: { targets: { attackType: 'range' } } } };
			getActiveConditionalBonuses(createAttacker([rule]) as never, item, undefined);
			expect(rule.matchesAttack).toHaveBeenCalledWith('ranged', 'weapon');
		});

		it('maps an unrecognized attack type to a null delivery', () => {
			const rule = createRule();
			const item = { type: 'weapon', system: { activation: { targets: { attackType: 'other' } } } };
			getActiveConditionalBonuses(createAttacker([rule]) as never, item, undefined);
			expect(rule.matchesAttack).toHaveBeenCalledWith(null, 'weapon');
		});

		it('infers a spell source for spell items', () => {
			const rule = createRule();
			const item = { type: 'spell', system: { activation: { targets: { attackType: 'reach' } } } };
			getActiveConditionalBonuses(createAttacker([rule]) as never, item, undefined);
			expect(rule.matchesAttack).toHaveBeenCalledWith('melee', 'spell');
		});
	});

	describe('getActiveConditionalBonuses — filtering', () => {
		it('returns an empty array when attacker or item is missing', () => {
			expect(getActiveConditionalBonuses(null, weaponItem, undefined)).toEqual([]);
			expect(getActiveConditionalBonuses(createAttacker([]) as never, null, undefined)).toEqual([]);
		});

		it('excludes rules of a different type', () => {
			const rule = createRule({ type: 'damageBonus' });
			expect(
				getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined),
			).toEqual([]);
		});

		it('excludes rules whose predicate does not apply', () => {
			const rule = createRule({ appliesTo: vi.fn(() => false) });
			expect(
				getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined),
			).toEqual([]);
		});

		it('excludes rules whose attack does not match', () => {
			const rule = createRule({ matchesAttack: vi.fn(() => false) });
			expect(
				getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined),
			).toEqual([]);
		});

		it('excludes rules whose target condition does not match', () => {
			const rule = createRule({ matchesTarget: vi.fn(() => false) });
			expect(
				getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined),
			).toEqual([]);
		});

		it('excludes rules that offer neither advantage nor damage', () => {
			const rule = createRule({
				offersAdvantage: vi.fn(() => false),
				offersDamage: vi.fn(() => false),
			});
			expect(
				getActiveConditionalBonuses(createAttacker([rule]) as never, weaponItem, undefined),
			).toEqual([]);
		});

		it('includes a matching rule as a resolved option', () => {
			const rule = createRule({
				offersDamage: vi.fn(() => true),
				damageType: 'radiant',
				resolveDamage: vi.fn(() => ({ value: 7, formula: null })),
			});
			const [option] = getActiveConditionalBonuses(
				createAttacker([rule]) as never,
				weaponItem,
				undefined,
			);
			expect(option).toEqual({
				ruleId: 'rule-id',
				label: 'Quarry',
				advantage: 1,
				damageValue: 7,
				damageFormula: null,
				damageType: 'radiant',
			});
		});

		it('reports advantage 0 for a damage-only bonus, not the stale advantage field', () => {
			const rule = createRule({
				advantage: 3,
				offersAdvantage: vi.fn(() => false),
				offersDamage: vi.fn(() => true),
				resolveDamage: vi.fn(() => ({ value: 4, formula: null })),
			});
			const [option] = getActiveConditionalBonuses(
				createAttacker([rule]) as never,
				weaponItem,
				undefined,
			);
			expect(option.advantage).toBe(0);
			expect(option.damageValue).toBe(4);
		});
	});

	describe('getActiveConditionalBonuses — label fallback', () => {
		it('uses the rule label when present', () => {
			const rule = createRule({ label: 'Mark of the Hunter' });
			const [option] = getActiveConditionalBonuses(
				createAttacker([rule]) as never,
				weaponItem,
				undefined,
			);
			expect(option.label).toBe('Mark of the Hunter');
		});

		it('falls back to the item name when the label is empty', () => {
			const rule = createRule({ label: '', item: { name: 'Longbow' } });
			const [option] = getActiveConditionalBonuses(
				createAttacker([rule]) as never,
				weaponItem,
				undefined,
			);
			expect(option.label).toBe('Longbow');
		});

		it('falls back to the localized rule type when label and item name are empty', () => {
			const rule = createRule({ label: '', item: undefined });
			const [option] = getActiveConditionalBonuses(
				createAttacker([rule]) as never,
				weaponItem,
				undefined,
			);
			expect(option.label).toBe('Conditional Bonus');
		});
	});

	describe('buildTargetDomain', () => {
		it("merges the target's own target:* tags with relational toggled-effect tags", () => {
			const attacker = {
				getFlag: () => ({
					quarry: [
						{
							actorUuid: 'Actor.t',
							tokenUuid: null,
							name: 'Goblin',
						},
					],
				}),
			};
			const target = {
				uuid: 'Actor.t',
				getTargetDomain: () => new Set(['target:bloodied']),
			};

			const domain = buildTargetDomain(attacker, target);

			expect(domain.has('target:bloodied')).toBe(true);
			expect(domain.has('target:quarry')).toBe(true);
		});

		it('returns only the toggled tags when the target exposes no getTargetDomain', () => {
			const attacker = {
				getFlag: () => ({
					quarry: [
						{
							actorUuid: 'Actor.t',
							tokenUuid: null,
							name: 'Goblin',
						},
					],
				}),
			};

			const domain = buildTargetDomain(attacker, { uuid: 'Actor.t' });

			expect([...domain]).toEqual(['target:quarry']);
		});

		it('returns an empty set when there is no attacker or target', () => {
			expect(buildTargetDomain(null, null).size).toBe(0);
		});
	});
});
