import { describe, expect, it } from 'vitest';
import { MaxHitDiceRule } from './maxHitDice.js';

describe('MaxHitDiceRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxHitDiceRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('dieSize');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxHitDiceRule.group).toBe('bonuses');
			expect(MaxHitDiceRule.description).toBe('NIMBLE.rules.maxHitDice.description');
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
			const rule = new MaxHitDiceRule(
				{
					value: '1',
					dieSize: 8,
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'maxHitDice',
				} as foundry.data.fields.SchemaField.CreateData<MaxHitDiceRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			) as MaxHitDiceRule & { disabled: boolean };

			rule.value = '1';
			rule.dieSize = 8;
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
				type: 'character',
				system: { attributes: { hitDice: {} as Record<string, { bonus?: number }> } },
				getRollData: () => ({}),
				getDomain: () => [],
			};
		}

		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule(actor).prePrepareData();

			expect(actor.system.attributes.hitDice['8']?.bonus).toBe(1);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(actor, { size: 1, test: () => false }).prePrepareData();

			expect(actor.system.attributes.hitDice['8']).toBeUndefined();
		});
	});
});
