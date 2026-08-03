import { describe, expect, it } from 'vitest';
import { ActionCostRule } from './actionCost.js';

describe('ActionCostRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ActionCostRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('applies');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('itemTypes');
			expect(schema).toHaveProperty('itemIdentifier');
			expect(schema).toHaveProperty('reactions');
		});

		it('declares closed applies, mode, item-type, and reaction choice sets', () => {
			const schema = ActionCostRule.defineSchema();
			const applies = schema.applies as unknown as { choices: string[] };
			expect(applies.choices).toEqual(['item', 'heroicReaction']);

			const mode = schema.mode as unknown as { choices: string[] };
			expect(mode.choices).toEqual(['delta', 'set']);

			const itemTypes = schema.itemTypes as unknown as {
				element: { choices: string[] };
			};
			expect(itemTypes.element.choices).toEqual(['feature', 'monsterFeature', 'object', 'spell']);

			const reactions = schema.reactions as unknown as {
				element: { choices: string[] };
			};
			expect(reactions.element.choices).toEqual([
				'defend',
				'interpose',
				'opportunityAttack',
				'help',
			]);
		});

		it('defaults applies to item, preserving pre-existing rule semantics', () => {
			const schema = ActionCostRule.defineSchema();
			const applies = schema.applies as unknown as { options: { initial: string } };
			expect(applies.options.initial).toBe('item');
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

	function createRule(
		config: {
			applies?: 'item' | 'heroicReaction';
			itemTypes?: string[];
			itemIdentifier?: string;
			reactions?: string[];
		} = {},
	) {
		// `itemTypes` / `reactions` are omitted and re-added as `string[]` because
		// the schema infers closed choice-union types that plain string literals
		// don't satisfy.
		const rule = new ActionCostRule(
			{ type: 'actionCost' } as foundry.data.fields.SchemaField.CreateData<
				ActionCostRule['schema']['fields']
			>,
			{ strict: false },
		) as unknown as Omit<ActionCostRule, 'itemTypes' | 'reactions'> & {
			applies: 'item' | 'heroicReaction';
			itemTypes: string[];
			itemIdentifier: string;
			reactions: string[];
		};

		rule.applies = config.applies ?? 'item';
		rule.itemTypes = config.itemTypes ?? [];
		rule.itemIdentifier = config.itemIdentifier ?? '';
		rule.reactions = config.reactions ?? [];
		return rule;
	}

	describe('matchesItem', () => {
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

		it('never matches items when the rule applies to heroic reactions', () => {
			const rule = createRule({ applies: 'heroicReaction' });
			expect(rule.matchesItem({ type: 'spell' })).toBe(false);
		});
	});

	describe('matchesReaction', () => {
		it('matches every reaction when the reactions list is empty', () => {
			const rule = createRule({ applies: 'heroicReaction' });
			expect(rule.matchesReaction('defend')).toBe(true);
			expect(rule.matchesReaction('interpose')).toBe(true);
			expect(rule.matchesReaction('opportunityAttack')).toBe(true);
			expect(rule.matchesReaction('help')).toBe(true);
		});

		it('scopes by reaction key', () => {
			const rule = createRule({ applies: 'heroicReaction', reactions: ['defend'] });
			expect(rule.matchesReaction('defend')).toBe(true);
			expect(rule.matchesReaction('interpose')).toBe(false);
		});

		it('never matches reactions when the rule applies to items', () => {
			const rule = createRule({ applies: 'item' });
			expect(rule.matchesReaction('defend')).toBe(false);
		});
	});
});
