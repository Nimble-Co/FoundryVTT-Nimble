import { describe, expect, it } from 'vitest';
import { MaxWoundsRule } from './maxWounds.js';

describe('MaxWoundsRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxWoundsRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxWoundsRule.group).toBe('bonuses');
			expect(MaxWoundsRule.description).toBe('NIMBLE.rules.maxWounds.description');
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
			const rule = new MaxWoundsRule(
				{
					value: '2',
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'maxWounds',
				} as foundry.data.fields.SchemaField.CreateData<MaxWoundsRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			) as MaxWoundsRule & { value: string; disabled: boolean };

			rule.value = '2';
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
				system: { attributes: { wounds: { bonus: 0 } } },
				getRollData: () => ({}),
				getDomain: () => [],
			};
		}

		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule(actor).prePrepareData();

			expect(actor.system.attributes.wounds.bonus).toBe(2);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(actor, { size: 1, test: () => false }).prePrepareData();

			expect(actor.system.attributes.wounds.bonus).toBe(0);
		});
	});
});
