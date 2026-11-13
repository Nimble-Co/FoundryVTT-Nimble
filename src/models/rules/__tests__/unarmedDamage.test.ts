import { describe, expect, it } from 'vitest';
import { UnarmedDamageRule } from '../unarmedDamage.js';

describe('UnarmedDamageRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = UnarmedDamageRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
		});
	});

	describe('afterPrepareData', () => {
		it('puts the stacks of its effect into the formula, which the unarmed strike rolls', () => {
			const actor = { system: {} as Record<string, unknown>, getDomain: () => new Set<string>() };
			const item = { isEmbedded: true, actor, getDomain: () => new Set<string>() };
			const rule = new UnarmedDamageRule({ type: 'unarmedDamage' } as never, {
				parent: item as never,
				strict: false,
			});
			Object.assign(rule, { value: '(@stacks)d4', disabled: false });
			Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
			Object.defineProperty(rule, 'predicate', { get: () => ({ size: 0 }), configurable: true });
			Object.defineProperty(rule, 'stacks', { get: () => 2, configurable: true });

			rule.afterPrepareData();

			expect(actor.system.unarmedDamage).toBe('(2)d4');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(UnarmedDamageRule.group).toBe('bonuses');
			expect(UnarmedDamageRule.description).toBe('NIMBLE.rules.unarmedDamage.description');
		});
	});
});
