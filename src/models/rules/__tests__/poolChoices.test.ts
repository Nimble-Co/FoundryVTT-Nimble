import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ChargePoolRuleConfig } from '#utils/chargePool/chargePoolRuleConfig.js';
import { DicePoolRuleConfig } from '#utils/dicePool/dicePoolRuleConfig.js';
import { ChargePoolRule } from '../chargePool.js';
import { DicePoolRule } from '../dicePool.js';
import { ModifyPoolRule } from '../modifyPool.js';

const en = JSON.parse(readFileSync(path.resolve(process.cwd(), 'public/lang/en.json'), 'utf-8'));

function langValue(key: string): unknown {
	return key.split('.').reduce<unknown>((node, part) => {
		if (node && typeof node === 'object') return (node as Record<string, unknown>)[part];
		return undefined;
	}, en);
}

type EntryField = { choices?: unknown; hint?: string };

function entryFields(schema: Record<string, unknown>, list: string): Record<string, EntryField> {
	return (schema[list] as unknown as { element: { fields: Record<string, EntryField> } }).element
		.fields;
}

const RULES = [
	{
		name: 'Charge Pool',
		fields: () => entryFields(ChargePoolRule.defineSchema(), 'recoveries'),
		triggers: ChargePoolRuleConfig.recoveryTriggers,
		modes: ChargePoolRuleConfig.recoveryModes,
	},
	{
		name: 'Dice Pool',
		fields: () => entryFields(DicePoolRule.defineSchema(), 'refills'),
		triggers: DicePoolRuleConfig.refillTriggers,
		modes: DicePoolRuleConfig.refillModes,
	},
	{
		name: 'Modify Pool',
		fields: () => entryFields(ModifyPoolRule.defineSchema(), 'addRefills'),
		triggers: [...DicePoolRuleConfig.refillTriggers, ...ChargePoolRuleConfig.recoveryTriggers],
		modes: DicePoolRuleConfig.refillModes,
	},
] as const;

describe.each(RULES)('$name trigger and mode choices', ({ fields, triggers, modes }) => {
	it.each(['trigger', 'mode'] as const)('passes the %s choices as value to lang key', (name) => {
		const choices = fields()[name].choices;
		expect(choices).toBeTypeOf('object');
		expect(Array.isArray(choices)).toBe(false);
	});

	it('gives every trigger a label key that exists in en.json, with no placeholder', () => {
		const choices = fields().trigger.choices as Record<string, string>;
		expect(Object.keys(choices).sort()).toEqual([...new Set(triggers)].sort());
		for (const value of triggers) {
			const label = langValue(choices[value]);
			expect(label, `${value} -> ${choices[value]}`).toBeTypeOf('string');
			expect(label as string).not.toMatch(/\{\w+\}/);
		}
	});

	it('gives every mode a label key that exists in en.json, with no placeholder', () => {
		const choices = fields().mode.choices as Record<string, string>;
		expect(Object.keys(choices).sort()).toEqual([...modes].sort());
		for (const value of modes) {
			const label = langValue(choices[value]);
			expect(label, `${value} -> ${choices[value]}`).toBeTypeOf('string');
			expect(label as string).not.toMatch(/\{\w+\}/);
		}
	});
});

describe('Modify Pool mode hint', () => {
	it('names the modes a charge pool ignores', () => {
		const mode = entryFields(ModifyPoolRule.defineSchema(), 'addRefills').mode;
		const choices = mode.choices as Record<string, string>;
		const hint = langValue(mode.hint ?? '') as string;
		const chargeIgnores = DicePoolRuleConfig.refillModes.filter(
			(m) => !(ChargePoolRuleConfig.recoveryModes as readonly string[]).includes(m),
		);

		expect(chargeIgnores).toEqual(['setIfEmpty', 'clear']);
		expect(hint).toBeTypeOf('string');
		for (const value of chargeIgnores) {
			expect(hint).toContain(langValue(choices[value]) as string);
		}
		expect(hint).toMatch(/charge pool ignores/i);
	});
});
