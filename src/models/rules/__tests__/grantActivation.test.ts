import { describe, expect, it } from 'vitest';
import { GrantActivationRule } from '../grantActivation.js';

describe('GrantActivationRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = GrantActivationRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('activationType');
		});

		it('declares a closed activation-type choice set defaulting to weaponAttack', () => {
			const schema = GrantActivationRule.defineSchema();
			const activationType = schema.activationType as unknown as {
				choices: string[];
				options: { initial: string };
			};
			expect(activationType.choices).toEqual(['weaponAttack']);
			expect(activationType.options.initial).toBe('weaponAttack');
		});

		it('keeps the behaviour of older data with every new option at its default', () => {
			const schema = GrantActivationRule.defineSchema() as unknown as Record<
				string,
				{ options: { initial: unknown }; choices?: Record<string, string> }
			>;
			expect(schema.trigger?.options.initial).toBe('onActivation');
			expect(Object.keys(schema.trigger?.choices ?? {})).toEqual(['onActivation', 'onInterpose']);
			expect(schema.free?.options.initial).toBe(false);
			expect(schema.spendsReaction?.options.initial).toBe(false);
			expect(schema.weaponKind?.options.initial).toBe('any');
			expect(Object.keys(schema.weaponKind?.choices ?? {})).toEqual([
				'any',
				'melee',
				'ranged',
				'unarmed',
			]);
			expect(schema.allowsCantrips?.options.initial).toBe(false);
			expect(schema.ignoresRushed?.options.initial).toBe(false);
			expect(schema.condition?.options.initial).toBe('');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(GrantActivationRule.group).toBe('resource');
			expect(GrantActivationRule.description).toBe('NIMBLE.rules.grantActivation.description');
		});

		it('declares no lifecycle hooks', () => {
			// A pure offer descriptor must never run during data preparation.
			expect(GrantActivationRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(GrantActivationRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});
});
