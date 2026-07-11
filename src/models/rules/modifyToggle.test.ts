import { describe, expect, it, vi } from 'vitest';

import { ModifyToggleRule } from './modifyToggle.js';
import { TURN_OFF_CHOICES, type TurnOffEvent } from './toggleEffect.js';

interface MockActor {
	getDomain: () => Set<string>;
}

interface MockItem {
	actor: MockActor;
	isEmbedded: boolean;
	name: string;
	id: string;
	uuid: string;
	getDomain: () => Set<string>;
}

interface ModifyToggleSource {
	toggleIdentifier: string;
	suppressTurnOff: TurnOffEvent[];
	disabled?: boolean;
	label?: string;
	id?: string;
	identifier?: string;
	priority?: number;
	predicate?: Record<string, unknown>;
}

function createMockActor(): MockActor {
	return { getDomain: vi.fn(() => new Set<string>()) };
}

function createMockItem(actor: MockActor): MockItem {
	return {
		actor,
		isEmbedded: true,
		name: 'Test Feature',
		id: 'item-id',
		uuid: 'test-item-uuid',
		getDomain: vi.fn(() => new Set<string>()),
	};
}

function createModifyToggleRule(config: ModifyToggleSource): ModifyToggleRule {
	const actor = createMockActor();
	const parentItem = createMockItem(actor);
	const sourceData = {
		toggleIdentifier: config.toggleIdentifier,
		suppressTurnOff: config.suppressTurnOff,
		disabled: config.disabled ?? false,
		label: config.label ?? '',
		id: config.id ?? 'rule-id',
		identifier: config.identifier ?? '',
		priority: config.priority ?? 1,
		predicate: config.predicate ?? {},
		type: 'modifyToggle',
	};

	const rule = new ModifyToggleRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<ModifyToggleRule['schema']['fields']>,
		{ parent: parentItem as unknown as foundry.abstract.DataModel.Any, strict: false },
	);

	// The test-suite DataModel mock does not hydrate schema fields from the
	// source object, so populate them manually (same convention as
	// toggleEffect.test.ts).
	rule.type = sourceData.type;
	rule.toggleIdentifier = sourceData.toggleIdentifier;
	rule.suppressTurnOff = sourceData.suppressTurnOff;
	rule.disabled = sourceData.disabled;
	rule.label = sourceData.label;

	Object.defineProperty(rule, 'item', { get: () => parentItem, configurable: true });

	return rule;
}

describe('ModifyToggleRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ModifyToggleRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('toggleIdentifier');
			expect(schema).toHaveProperty('suppressTurnOff');
		});

		it('defaults type to modifyToggle', () => {
			const schema = ModifyToggleRule.defineSchema();
			const typeField = schema.type as unknown as { initial: string };
			expect(typeField.initial).toBe('modifyToggle');
		});

		it('shares the toggleEffect turn-off vocabulary for suppressTurnOff choices', () => {
			const schema = ModifyToggleRule.defineSchema();
			const suppressField = schema.suppressTurnOff as unknown as {
				element: { choices: readonly string[] };
			};
			const choices = suppressField.element.choices;
			expect(choices).toEqual([...TURN_OFF_CHOICES]);
			expect(choices).toContain('onActorKilled');
			expect(choices).toContain('onActorWounded');
			expect(choices).toContain('onRest');
			expect(choices).toContain('onTurnStart');
			expect(choices).toContain('onTurnEnd');
			expect(choices).toContain('onEncounterEnd');
			expect(choices).toContain('onActorDying');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(ModifyToggleRule.group).toBe('triggers');
			expect(ModifyToggleRule.description).toBe('NIMBLE.rules.modifyToggle.description');
		});
	});

	describe('construction', () => {
		it('constructs from source data with the configured fields', () => {
			const rule = createModifyToggleRule({
				toggleIdentifier: 'battle-focus',
				suppressTurnOff: ['onActorKilled'],
			});

			expect(rule.type).toBe('modifyToggle');
			expect(rule.toggleIdentifier).toBe('battle-focus');
			expect(rule.suppressTurnOff).toEqual(['onActorKilled']);
			expect(rule.disabled).toBe(false);
		});

		it('supports multiple suppressed turn-off events', () => {
			const rule = createModifyToggleRule({
				toggleIdentifier: 'battle-focus',
				suppressTurnOff: ['onActorKilled', 'onEncounterEnd'],
			});

			expect(rule.suppressTurnOff).toEqual(['onActorKilled', 'onEncounterEnd']);
		});

		it('implements no lifecycle hooks of its own (passive data rule)', () => {
			expect(Object.getOwnPropertyNames(ModifyToggleRule.prototype)).not.toContain(
				'prePrepareData',
			);
			expect(Object.getOwnPropertyNames(ModifyToggleRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});
});
