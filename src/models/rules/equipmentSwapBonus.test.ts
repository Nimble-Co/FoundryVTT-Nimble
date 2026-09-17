import { describe, expect, it } from 'vitest';
import { EquipmentSwapBonusRule } from './equipmentSwapBonus.js';

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
	const rule = new EquipmentSwapBonusRule(
		{
			value,
			disabled: false,
			label: 'Test Rule',
			id: 'test-rule-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'equipmentSwapBonus',
		} as foundry.data.fields.SchemaField.CreateData<EquipmentSwapBonusRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as EquipmentSwapBonusRule & { value: string; disabled: boolean };

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
		system: { attributes: { equipmentSwapBonus: 0 } },
		getRollData: () => ({}),
		getDomain: () => [],
	};
}

describe('EquipmentSwapBonusRule', () => {
	it('defines the expected fields', () => {
		const schema = EquipmentSwapBonusRule.defineSchema();

		expect(schema).toHaveProperty('type');
		expect(schema).toHaveProperty('value');
	});

	it('exposes the picker group and i18n description key', () => {
		expect(EquipmentSwapBonusRule.group).toBe('bonuses');
		expect(EquipmentSwapBonusRule.description).toBe('NIMBLE.rules.equipmentSwapBonus.description');
	});

	it('adds its value when the predicate passes', () => {
		const actor = createMockActor();
		createRule(actor, '1').prePrepareData();

		expect(actor.system.attributes.equipmentSwapBonus).toBe(1);
	});

	it('accumulates across rules', () => {
		const actor = createMockActor();
		createRule(actor, '1').prePrepareData();
		createRule(actor, '2').prePrepareData();

		expect(actor.system.attributes.equipmentSwapBonus).toBe(3);
	});

	it('does nothing when the predicate fails', () => {
		const actor = createMockActor();
		createRule(actor, '1', { size: 1, test: () => false }).prePrepareData();

		expect(actor.system.attributes.equipmentSwapBonus).toBe(0);
	});
});
