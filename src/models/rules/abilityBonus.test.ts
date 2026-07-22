import { describe, expect, it } from 'vitest';
import { AbilityBonusRule } from './abilityBonus.js';

describe('AbilityBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = AbilityBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('abilities');
		});

		it('declares choices on the abilities array element (with `all` sentinel)', () => {
			const schema = AbilityBonusRule.defineSchema();
			const arrayField = schema.abilities as unknown as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('strength');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(AbilityBonusRule.group).toBe('bonuses');
			expect(AbilityBonusRule.description).toBe('NIMBLE.rules.abilityBonus.description');
		});
	});

	describe('prePrepareData predicate gating', () => {
		function createRule(
			actor: object,
			predicate?: { size: number; test: (domain: Set<string>) => boolean },
		) {
			const item = {
				isEmbedded: true,
				actor,
				name: 'Test Item',
				uuid: 'test-item-uuid',
				getDomain: () => [],
			};
			const rule = new AbilityBonusRule(
				{
					value: '2',
					abilities: ['strength'],
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'abilityBonus',
				} as foundry.data.fields.SchemaField.CreateData<AbilityBonusRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			) as AbilityBonusRule & { value: string; abilities: string[]; disabled: boolean };

			rule.value = '2';
			rule.abilities = ['strength'];
			rule.disabled = false;

			Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
			Object.defineProperty(rule, 'actor', { get: () => item.actor, configurable: true });
			Object.defineProperty(rule, '_predicate', {
				get: () => predicate ?? { size: 0 },
				configurable: true,
			});
			return rule;
		}

		function createMockActor() {
			return {
				system: { abilities: { strength: { bonus: 0 } } },
				getRollData: () => ({}),
				getDomain: () => [],
			};
		}

		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule(actor).prePrepareData();

			expect(actor.system.abilities.strength.bonus).toBe(2);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(actor, { size: 1, test: () => false }).prePrepareData();

			expect(actor.system.abilities.strength.bonus).toBe(0);
		});
	});
});
