import { describe, expect, it, vi } from 'vitest';

import {
	LASTS_UNTIL_EVENTS,
	type LastsUntilEvent,
} from '../../activeEffect/nimbleEffectChoices.js';
import { ModifyToggleRule } from '../modifyToggle.js';

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
	dropMoments: LastsUntilEvent[];
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
		dropMoments: config.dropMoments,
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
	rule.dropMoments = sourceData.dropMoments;
	rule.disabled = sourceData.disabled;
	rule.label = sourceData.label;

	Object.defineProperty(rule, 'parent', { get: () => parentItem, configurable: true });

	return rule;
}

describe('ModifyToggleRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = ModifyToggleRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('toggleIdentifier');
			expect(schema).toHaveProperty('dropMoments');
			expect(schema).not.toHaveProperty('suppressTurnOff');
		});

		it('defaults type to modifyToggle', () => {
			const schema = ModifyToggleRule.defineSchema();
			const typeField = schema.type as unknown as { initial: string };
			expect(typeField.initial).toBe('modifyToggle');
		});

		it('offers the toggleEffect turn-on vocabulary for turnOn choices', () => {
			const schema = ModifyToggleRule.defineSchema();
			const turnOnField = schema.turnOn as unknown as {
				element: { choices: Record<string, string> };
			};
			expect(Object.keys(turnOnField.element.choices)).toEqual([
				'onTurnStart',
				'onActorDying',
				'onCritReceived',
			]);
		});

		it('offers every Lasts Until event to drop, each with a label key', () => {
			const schema = ModifyToggleRule.defineSchema();
			const dropField = schema.dropMoments as unknown as {
				element: { choices: Record<string, string> };
			};
			const { choices } = dropField.element;
			expect(Object.keys(choices)).toEqual([...LASTS_UNTIL_EVENTS]);
			expect(choices.zeroHp).toBe('NIMBLE.rules.modifyToggle.dropMoments.choices.zeroHp');
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
				dropMoments: ['zeroHp'],
			});

			expect(rule.type).toBe('modifyToggle');
			expect(rule.toggleIdentifier).toBe('battle-focus');
			expect(rule.dropMoments).toEqual(['zeroHp']);
			expect(rule.disabled).toBe(false);
		});

		it('supports more than one dropped moment', () => {
			const rule = createModifyToggleRule({
				toggleIdentifier: 'battle-focus',
				dropMoments: ['zeroHp', 'combatEnd'],
			});

			expect(rule.dropMoments).toEqual(['zeroHp', 'combatEnd']);
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
