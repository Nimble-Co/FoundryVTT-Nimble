import { describe, expect, it, vi } from 'vitest';
import { MaxHpBonusRule } from './maxHpBonus.js';

describe('MaxHpBonusRule', () => {
	function createRule(
		options: {
			value?: number;
			perLevel?: boolean;
			level?: number | { value: number };
			isEmbedded?: boolean;
			uuid?: string;
			predicate?: { size: number; test: (domain: Set<string>) => boolean };
		} = {},
	) {
		const {
			value = 2,
			perLevel = false,
			level = 1,
			isEmbedded = true,
			uuid = 'test-item-uuid',
			predicate,
		} = options;

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
			uuid,
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

	describe('afterPrepareData phase-mismatch warning', () => {
		/** A predicate whose answer changes once the late tags are populated. */
		function latePredicate(state: { passes: boolean }) {
			return { size: 1, test: () => state.passes };
		}

		it('warns when the predicate only starts matching after max HP is computed', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const state = { passes: false };
			const rule = createRule({ uuid: 'late-match', predicate: latePredicate(state) });

			expect(rule.resolvedBonus()).toBe(0);

			state.passes = true;
			rule.afterPrepareData();

			expect(warn).toHaveBeenCalledOnce();
			expect(warn.mock.calls[0][0]).toContain('added nothing');
			warn.mockRestore();
		});

		it('warns once per rule, not once per prepare cycle', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const state = { passes: false };
			const rule = createRule({ uuid: 'late-match-repeat', predicate: latePredicate(state) });

			for (let cycle = 0; cycle < 3; cycle += 1) {
				state.passes = false;
				rule.resolvedBonus();
				state.passes = true;
				rule.afterPrepareData();
			}

			expect(warn).toHaveBeenCalledOnce();
			warn.mockRestore();
		});

		it('stays quiet when the predicate matches during the HP pass', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRule({ uuid: 'early-match', predicate: latePredicate({ passes: true }) });

			rule.resolvedBonus();
			rule.afterPrepareData();

			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});

		it('stays quiet for a rule that never matches at all', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRule({ uuid: 'never-match', predicate: latePredicate({ passes: false }) });

			rule.resolvedBonus();
			rule.afterPrepareData();

			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});

		it('stays quiet for an unpredicated rule', () => {
			const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
			const rule = createRule({ uuid: 'no-predicate' });

			rule.resolvedBonus();
			rule.afterPrepareData();

			expect(warn).not.toHaveBeenCalled();
			warn.mockRestore();
		});
	});
});
