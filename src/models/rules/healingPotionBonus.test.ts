import { describe, expect, it } from 'vitest';
import { HealingPotionBonusRule } from './healingPotionBonus.js';

describe('HealingPotionBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = HealingPotionBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(HealingPotionBonusRule.group).toBe('bonuses');
			expect(HealingPotionBonusRule.description).toBe(
				'NIMBLE.rules.healingPotionBonus.description',
			);
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
			const rule = new HealingPotionBonusRule(
				{
					value: '2',
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'healingPotionBonus',
				} as foundry.data.fields.SchemaField.CreateData<HealingPotionBonusRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			) as HealingPotionBonusRule & { value: string; disabled: boolean };

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
				system: {} as { healingPotionBonus?: number },
				getRollData: () => ({}),
				getDomain: () => [],
			};
		}

		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule(actor).prePrepareData();

			expect(actor.system.healingPotionBonus).toBe(2);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(actor, { size: 1, test: () => false }).prePrepareData();

			expect(actor.system.healingPotionBonus).toBeUndefined();
		});
	});
});
