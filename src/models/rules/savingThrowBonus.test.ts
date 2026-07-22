import { describe, expect, it } from 'vitest';
import { SavingThrowBonusRule } from './savingThrowBonus.js';

describe('SavingThrowBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SavingThrowBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('savingThrows');
		});

		it('declares choices on savingThrows array (with `all` sentinel)', () => {
			const schema = SavingThrowBonusRule.defineSchema();
			const arrayField = schema.savingThrows as unknown as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('strength');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SavingThrowBonusRule.group).toBe('bonuses');
			expect(SavingThrowBonusRule.description).toBe('NIMBLE.rules.savingThrowBonus.description');
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
			const rule = new SavingThrowBonusRule(
				{
					value: '2',
					savingThrows: ['strength'],
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'savingThrowBonus',
				} as foundry.data.fields.SchemaField.CreateData<SavingThrowBonusRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			) as SavingThrowBonusRule & { value: string; savingThrows: string[]; disabled: boolean };

			rule.value = '2';
			rule.savingThrows = ['strength'];
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
				system: { savingThrows: { strength: { bonus: 0 } } },
				getRollData: () => ({}),
				getDomain: () => [],
			};
		}

		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule(actor).prePrepareData();

			expect(actor.system.savingThrows.strength.bonus).toBe(2);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(actor, { size: 1, test: () => false }).prePrepareData();

			expect(actor.system.savingThrows.strength.bonus).toBe(0);
		});
	});
});
