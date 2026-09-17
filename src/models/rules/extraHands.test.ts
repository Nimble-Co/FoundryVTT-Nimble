import { describe, expect, it } from 'vitest';
import { ExtraHandsRule } from './extraHands.js';

function createRule(
	actor: object,
	value: string,
	predicate?: { size: number; test: (domain: Set<string>) => boolean },
) {
	const item = {
		isEmbedded: true,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: () => [],
	};
	const rule = new ExtraHandsRule(
		{
			value,
			disabled: false,
			label: 'Test Rule',
			id: 'test-rule-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'extraHands',
		} as foundry.data.fields.SchemaField.CreateData<ExtraHandsRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as ExtraHandsRule & { value: string; disabled: boolean };

	rule.value = value;
	rule.disabled = false;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => item.actor, configurable: true });
	Object.defineProperty(rule, 'predicate', {
		get: () => predicate ?? { size: 0 },
		configurable: true,
	});
	return rule;
}

function createMockActor() {
	return {
		system: { attributes: { extraHands: 0 } },
		getRollData: () => ({}),
		getDomain: () => [],
	};
}

describe('ExtraHandsRule', () => {
	it('defines the expected fields', () => {
		const schema = ExtraHandsRule.defineSchema();

		expect(schema).toHaveProperty('type');
		expect(schema).toHaveProperty('value');
	});

	it('exposes the picker group and i18n description key', () => {
		expect(ExtraHandsRule.group).toBe('bonuses');
		expect(ExtraHandsRule.description).toBe('NIMBLE.rules.extraHands.description');
	});

	it('adds its value when the predicate passes', () => {
		const actor = createMockActor();
		createRule(actor, '4').prePrepareData();

		expect(actor.system.attributes.extraHands).toBe(4);
	});

	it('accumulates across rules', () => {
		const actor = createMockActor();
		createRule(actor, '1').prePrepareData();
		createRule(actor, '2').prePrepareData();

		expect(actor.system.attributes.extraHands).toBe(3);
	});

	it('does nothing when the predicate fails', () => {
		const actor = createMockActor();
		createRule(actor, '4', { size: 1, test: () => false }).prePrepareData();

		expect(actor.system.attributes.extraHands).toBe(0);
	});
});
