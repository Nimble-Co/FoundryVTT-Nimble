import { describe, expect, it } from 'vitest';
import { getMaxHpBonusPerLevel, MaxHpBonusRule } from './maxHpBonus.js';

interface RuleSource {
	type?: string;
	value?: number;
	perLevel?: boolean;
	disabled?: boolean;
	invalid?: boolean;
}

function actorCarrying(...items: RuleSource[][]) {
	return {
		items: items.map((rules) => ({
			rules: new Map(rules.map((rule, index) => [`rule-${index}`, rule])),
		})),
	};
}

describe('MaxHpBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxHpBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('perLevel');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxHpBonusRule.group).toBe('bonuses');
			expect(MaxHpBonusRule.description).toBe('NIMBLE.rules.maxHpBonus.description');
		});
	});

	describe('getMaxHpBonusPerLevel', () => {
		it('totals the per-level rules across every item on the actor', () => {
			const actor = actorCarrying(
				[{ type: 'maxHpBonus', value: 2, perLevel: true }],
				[{ type: 'maxHpBonus', value: 3, perLevel: true }],
			);

			expect(getMaxHpBonusPerLevel(actor)).toBe(5);
		});

		it('ignores flat bonuses and rules of other types', () => {
			const actor = actorCarrying([
				{ type: 'maxHpBonus', value: 5, perLevel: false },
				{ type: 'maxWounds', value: 7, perLevel: true },
			]);

			expect(getMaxHpBonusPerLevel(actor)).toBe(0);
		});

		it('counts a disabled rule, because its bonus is still in the stored total', () => {
			// `preCreate` adds the bonus without consulting `disabled`, so leaving a
			// disabled rule out here would strand its contribution at the old level.
			const actor = actorCarrying([
				{ type: 'maxHpBonus', value: 2, perLevel: true, disabled: true },
			]);

			expect(getMaxHpBonusPerLevel(actor)).toBe(2);
		});

		it('skips an invalid rule, which never contributed in the first place', () => {
			// `preCreate` bails on `invalid`, so there is nothing stored to move.
			const actor = actorCarrying([
				{ type: 'maxHpBonus', value: 2, perLevel: true, invalid: true },
			]);

			expect(getMaxHpBonusPerLevel(actor)).toBe(0);
		});

		it('returns nothing for an actor with no items', () => {
			expect(getMaxHpBonusPerLevel({})).toBe(0);
		});
	});
});
