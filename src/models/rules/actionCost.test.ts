import { describe, expect, it } from 'vitest';
import { ActionCostRule } from './actionCost.js';

describe('ActionCostRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ActionCostRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('itemTypes');
			expect(schema).toHaveProperty('itemIdentifier');
		});

		it('declares closed mode and item-type choice sets', () => {
			const schema = ActionCostRule.defineSchema();
			const mode = schema.mode as unknown as { choices: string[] };
			expect(mode.choices).toEqual(['delta', 'set']);

			const itemTypes = schema.itemTypes as unknown as {
				element: { choices: string[] };
			};
			expect(itemTypes.element.choices).toEqual(['feature', 'monsterFeature', 'object', 'spell']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ActionCostRule.group).toBe('resource');
			expect(ActionCostRule.description).toBe('NIMBLE.rules.actionCost.description');
		});

		it('declares no lifecycle hooks', () => {
			// A pure cost descriptor must never run during data preparation.
			expect(ActionCostRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(ActionCostRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});

	describe('matchesItem', () => {
		function createRule(config: { itemTypes?: string[]; itemIdentifier?: string } = {}) {
			// `itemTypes` is omitted and re-added as `string[]` because the schema
			// infers a closed choice-union type that plain string literals don't satisfy.
			const rule = new ActionCostRule(
				{ type: 'actionCost' } as foundry.data.fields.SchemaField.CreateData<
					ActionCostRule['schema']['fields']
				>,
				{ strict: false },
			) as unknown as Omit<ActionCostRule, 'itemTypes'> & {
				itemTypes: string[];
				itemIdentifier: string;
			};

			rule.itemTypes = config.itemTypes ?? [];
			rule.itemIdentifier = config.itemIdentifier ?? '';
			return rule;
		}

		it('matches everything when both scoping fields are empty', () => {
			const rule = createRule();
			expect(rule.matchesItem({ type: 'spell' })).toBe(true);
			expect(rule.matchesItem({ type: 'feature', system: { identifier: 'defend' } })).toBe(true);
		});

		it('rejects null items', () => {
			expect(createRule().matchesItem(null)).toBe(false);
		});

		it('scopes by item type', () => {
			const rule = createRule({ itemTypes: ['spell'] });
			expect(rule.matchesItem({ type: 'spell' })).toBe(true);
			expect(rule.matchesItem({ type: 'feature' })).toBe(false);
		});

		it('scopes by item identifier', () => {
			const rule = createRule({ itemIdentifier: 'defend' });
			expect(rule.matchesItem({ type: 'feature', system: { identifier: 'defend' } })).toBe(true);
			expect(rule.matchesItem({ type: 'feature', system: { identifier: 'load' } })).toBe(false);
			expect(rule.matchesItem({ type: 'feature' })).toBe(false);
		});
	});
});
