import { describe, expect, it } from 'vitest';
import { itemEffectRuleFields, itemEffectUsers } from '../itemEffectUsers.ts';

const applyNode = (id: string, effectId: string | null, recipient = 'targets') => ({
	id,
	type: 'applyEffect',
	effectId,
	recipient,
	parentContext: null,
	parentNode: null,
});

function itemWith({
	tree = [] as unknown[],
	rules = [] as Record<string, unknown>[],
	effects = [] as Record<string, unknown>[],
} = {}) {
	return {
		system: { activation: { effects: tree }, rules },
		effects: new Map(effects.map((effect) => [effect.id as string, effect])),
	};
}

describe('itemEffectRuleFields', () => {
	it('finds the fields with the item effect picker widget from the rule schema', () => {
		expect(itemEffectRuleFields({ type: 'applyCondition' })).toEqual(['effectId']);
		expect(itemEffectRuleFields({ type: 'markTarget' })).toEqual(['effectId']);
		expect(itemEffectRuleFields({ type: 'defendOption' })).toEqual(['attackerEffectId']);
	});

	it('finds no field on a rule without the widget, or of a type that is not known', () => {
		expect(itemEffectRuleFields({ type: 'speedBonus' })).toEqual([]);
		expect(itemEffectRuleFields({ type: 'notARule' })).toEqual([]);
		expect(itemEffectRuleFields({})).toEqual([]);
	});
});

describe('itemEffectUsers', () => {
	it('finds Apply Effect nodes at any depth that point at the effect', () => {
		const damage = {
			id: 'd1',
			type: 'damage',
			parentContext: null,
			parentNode: null,
			on: { hit: [applyNode('deep', 'fx', 'self')], miss: [applyNode('other', 'nope')] },
		};
		const item = itemWith({ tree: [applyNode('top', 'fx'), damage] });

		expect(itemEffectUsers(item, 'fx')).toEqual([
			{ kind: 'node', nodeId: 'top', recipient: 'targets' },
			{ kind: 'node', nodeId: 'deep', recipient: 'self' },
		]);
	});

	it('finds rules of the item and of its effects whose effect fields hold the id', () => {
		const markRule = { id: 'r1', type: 'markTarget', effectId: 'fx' };
		const defendRule = { id: 'r2', type: 'defendOption', attackerEffectId: 'fx' };
		const holder = { id: 'other', system: { rules: [defendRule] } };
		const item = itemWith({
			rules: [markRule, { id: 'r3', type: 'applyCondition', effectId: 'not-fx' }],
			effects: [holder],
		});

		const users = itemEffectUsers(item, 'fx');

		expect(users).toEqual([
			{ kind: 'rule', holder: item, rule: markRule, fields: ['effectId'] },
			{ kind: 'rule', holder, rule: defendRule, fields: ['attackerEffectId'] },
		]);
	});

	it('finds nothing for an unused effect or no id', () => {
		const item = itemWith({ tree: [applyNode('n', 'other')] });

		expect(itemEffectUsers(item, 'fx')).toEqual([]);
		expect(itemEffectUsers(item, null)).toEqual([]);
	});
});
