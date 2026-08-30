import { describe, expect, it } from 'vitest';
import { MaxHpBonusRule } from './maxHpBonus.js';

describe('MaxHpBonusRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = MaxHpBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('perLevel');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(MaxHpBonusRule.group).toBe('bonuses');
			expect(MaxHpBonusRule.description).toBe('NIMBLE.rules.maxHpBonus.description');
		});

		it('declares itself early-phase so the late-predicate guardrails apply', () => {
			expect(MaxHpBonusRule.appliesInPrePrepareData).toBe(true);
		});
	});

	describe('resolvedBonus', () => {
		function createRule(
			options: {
				value?: number;
				perLevel?: boolean;
				level?: number | { value: number };
				isEmbedded?: boolean;
				predicate?: { size: number; test: (domain: Set<string>) => boolean };
			} = {},
		) {
			const { value = 2, perLevel = false, level = 1, isEmbedded = true, predicate } = options;

			// Read through a box so a test can advance the level on a live rule.
			const levelBox = typeof level === 'number' ? { value: level } : level;
			const actor = {
				getRollData: () => ({ level: levelBox.value }),
				getDomain: () => [],
			};
			const item = {
				isEmbedded,
				actor,
				name: 'Test Item',
				uuid: 'test-item-uuid',
				getDomain: () => [],
			};

			const rule = new MaxHpBonusRule(
				{
					value,
					perLevel,
					disabled: false,
					label: 'Test Rule',
					id: 'test-rule-id',
					identifier: '',
					priority: 1,
					predicate: {},
					type: 'maxHpBonus',
				} as foundry.data.fields.SchemaField.CreateData<MaxHpBonusRule['schema']['fields']>,
				{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
			);

			// The Foundry DataModel mock does not run schema initialization, so the
			// source values have to be assigned onto the instance directly.
			Object.assign(rule, { value, perLevel, disabled: false });

			Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
			Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
			Object.defineProperty(rule, 'predicate', {
				get: () => predicate ?? { size: 0 },
				configurable: true,
			});

			return rule;
		}

		it('returns the flat value when perLevel is off', () => {
			expect(createRule({ value: 4, level: 7 }).resolvedBonus()).toBe(4);
		});

		it('multiplies by the actor level when perLevel is on', () => {
			expect(createRule({ value: 2, perLevel: true, level: 5 }).resolvedBonus()).toBe(10);
		});

		it('rescales when the actor levels up, without being re-created', () => {
			const level = { value: 1 };
			const rule = createRule({ value: 2, perLevel: true, level });

			expect(rule.resolvedBonus()).toBe(2);

			level.value = 2;

			expect(rule.resolvedBonus()).toBe(4);
		});

		it('contributes nothing when the predicate fails', () => {
			const rule = createRule({ value: 4, predicate: { size: 1, test: () => false } });

			expect(rule.resolvedBonus()).toBe(0);
		});

		it('contributes nothing when the item is not embedded on an actor', () => {
			expect(createRule({ value: 4, isEmbedded: false }).resolvedBonus()).toBe(0);
		});
	});
});
