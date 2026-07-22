import { describe, expect, it } from 'vitest';
import { InitiativeRollModeRule } from './initiativeRollMode.js';

interface MockActor {
	system: { attributes: { initiative: { defaultRollMode?: number } } };
	getDomain: () => string[];
}

function createRule(
	config: {
		value: number;
		mode?: 'set' | 'adjust';
		predicate?: { size: number; test: (domain: Set<string>) => boolean };
	},
	actor: MockActor,
	isEmbedded = true,
) {
	const item = {
		isEmbedded,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: () => [],
	};

	const rule = new InitiativeRollModeRule(
		{
			value: config.value,
			mode: config.mode ?? 'adjust',
			disabled: false,
			label: 'Test Rule',
			id: 'test-rule-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'initiativeRollMode',
		} as foundry.data.fields.SchemaField.CreateData<InitiativeRollModeRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as InitiativeRollModeRule & { value: number; mode: string; disabled: boolean };

	rule.value = config.value;
	rule.mode = config.mode ?? 'adjust';
	rule.disabled = false;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => item.actor, configurable: true });
	Object.defineProperty(rule, '_predicate', {
		get: () => config.predicate ?? { size: 0 },
		configurable: true,
	});

	return rule;
}

describe('InitiativeRollModeRule', () => {
	describe('afterPrepareData', () => {
		it('applies the roll mode when the predicate passes', () => {
			const actor: MockActor = {
				system: { attributes: { initiative: { defaultRollMode: 0 } } },
				getDomain: () => [],
			};
			createRule({ value: 1 }, actor).afterPrepareData();

			expect(actor.system.attributes.initiative.defaultRollMode).toBe(1);
		});

		it('does nothing when the predicate fails', () => {
			const actor: MockActor = {
				system: { attributes: { initiative: { defaultRollMode: 0 } } },
				getDomain: () => [],
			};
			createRule({ value: 1, predicate: { size: 1, test: () => false } }, actor).afterPrepareData();

			expect(actor.system.attributes.initiative.defaultRollMode).toBe(0);
		});
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = InitiativeRollModeRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('mode');
		});

		it('declares the closed mode choice set', () => {
			const schema = InitiativeRollModeRule.defineSchema();
			const mode = schema.mode as unknown as { choices: string[] };
			expect(mode.choices).toEqual(['set', 'adjust']);
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(InitiativeRollModeRule.group).toBe('bonuses');
			expect(InitiativeRollModeRule.description).toBe(
				'NIMBLE.rules.initiativeRollMode.description',
			);
		});
	});
});
