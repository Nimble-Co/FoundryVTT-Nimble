import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import registerRulesConfig from '../registerRulesConfig.js';
import { RULE_CLASSES } from '../ruleClasses.js';

const lang = JSON.parse(
	readFileSync(path.resolve(process.cwd(), 'public/lang/en.json'), 'utf-8'),
) as { NIMBLE: { ruleTypes: Record<string, string> } };

describe('registerRulesConfig', () => {
	const { ruleDataModels, ruleTypes } = registerRulesConfig();

	it('registers every rule class under its type', () => {
		expect(ruleDataModels).toBe(RULE_CLASSES);
	});

	it('gives every rule type a label key that the lang file has', () => {
		for (const type of Object.keys(RULE_CLASSES)) {
			expect(ruleTypes[type as keyof typeof ruleTypes]).toBe(`NIMBLE.ruleTypes.${type}`);
			expect(lang.NIMBLE.ruleTypes[type], type).toBeTruthy();
		}
	});

	it('gives every rule type a Font Awesome icon', () => {
		for (const [type, RuleClass] of Object.entries(RULE_CLASSES)) {
			expect((RuleClass as unknown as { icon: string }).icon, type).toMatch(/^fa-solid fa-[\w-]+$/);
		}
	});
});
