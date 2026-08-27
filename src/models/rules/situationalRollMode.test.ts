import { describe, expect, it } from 'vitest';

import type { RollDialogType } from '#types/components/CheckRollDialog.d.ts';
import { SituationalRollModeRule } from './situationalRollMode.js';

interface RuleConfig {
	value?: number;
	checkType?: RollDialogType;
	saves?: string[];
	abilities?: string[];
	skills?: string[];
}

type TestRule = SituationalRollModeRule & {
	value: number;
	saves: string[];
	abilities: string[];
	skills: string[];
};

function createRule(config: RuleConfig = {}): TestRule {
	const sourceData = {
		value: config.value ?? 1,
		checkType: config.checkType ?? 'savingThrow',
		saves: config.saves ?? [],
		abilities: config.abilities ?? [],
		skills: config.skills ?? [],
		disabled: false,
		label: 'Against fear',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'situationalRollMode',
	};

	const rule = new SituationalRollModeRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<
			SituationalRollModeRule['schema']['fields']
		>,
		{ parent: undefined, strict: false },
	) as TestRule;

	// The mock DataModel does not assign source data onto the instance.
	rule.value = sourceData.value;
	rule.checkType = sourceData.checkType;
	rule.saves = sourceData.saves;
	rule.abilities = sourceData.abilities;
	rule.skills = sourceData.skills;

	return rule;
}

describe('SituationalRollModeRule', () => {
	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SituationalRollModeRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('checkType');
			expect(schema).toHaveProperty('saves');
			expect(schema).toHaveProperty('abilities');
			expect(schema).toHaveProperty('skills');
		});

		it('offers a target list for every check type that has target keys', () => {
			const schema = SituationalRollModeRule.defineSchema();
			const checkType = schema.checkType as unknown as { choices: () => Record<string, string> };
			const keyed = Object.keys(checkType.choices()).filter((type) => type !== 'initiative');
			const targetFields = {
				savingThrow: 'saves',
				abilityCheck: 'abilities',
				skillCheck: 'skills',
			};

			for (const type of keyed) expect(schema).toHaveProperty(targetFields[type]);
		});

		it('shows only the target list matching the selected check type', () => {
			const schema = SituationalRollModeRule.defineSchema();
			const showWhen = (field: string) =>
				(schema[field] as unknown as { showWhen: (data: { checkType: string }) => boolean })
					.showWhen;

			expect(showWhen('saves')({ checkType: 'savingThrow' })).toBe(true);
			expect(showWhen('saves')({ checkType: 'skillCheck' })).toBe(false);
			expect(showWhen('abilities')({ checkType: 'abilityCheck' })).toBe(true);
			expect(showWhen('skills')({ checkType: 'skillCheck' })).toBe(true);
			expect(showWhen('skills')({ checkType: 'savingThrow' })).toBe(false);
		});

		it('accepts the "all" sentinel alongside the real keys in every target list', () => {
			const schema = SituationalRollModeRule.defineSchema();
			for (const field of ['saves', 'abilities', 'skills']) {
				const element = (schema[field] as unknown as { element: { choices: () => string[] } })
					.element;
				expect(element.choices()).toContain('all');
			}
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SituationalRollModeRule.group).toBe('bonuses');
			expect(SituationalRollModeRule.description).toBe(
				'NIMBLE.rules.situationalRollMode.description',
			);
		});

		// Implementing either data-prep hook would apply the adjustment to every roll,
		// which is the blanket behavior this rule exists to replace.
		it('implements no data-prep hook', () => {
			expect(SituationalRollModeRule.appliesInPrePrepareData).toBe(false);
			expect(Object.getOwnPropertyNames(SituationalRollModeRule.prototype)).not.toContain(
				'afterPrepareData',
			);
		});
	});

	describe('offersAdjustment', () => {
		it('offers a positive adjustment', () => {
			expect(createRule({ value: 1 }).offersAdjustment()).toBe(true);
		});

		it('offers a negative adjustment', () => {
			expect(createRule({ value: -2 }).offersAdjustment()).toBe(true);
		});

		it('declines a zero adjustment, which would toggle nothing', () => {
			expect(createRule({ value: 0 }).offersAdjustment()).toBe(false);
		});
	});

	describe('matchesRoll', () => {
		it('matches a save named in the save list', () => {
			const rule = createRule({ checkType: 'savingThrow', saves: ['will'] });
			expect(rule.matchesRoll('savingThrow', 'will')).toBe(true);
		});

		it('rejects a save absent from the save list', () => {
			const rule = createRule({ checkType: 'savingThrow', saves: ['will'] });
			expect(rule.matchesRoll('savingThrow', 'strength')).toBe(false);
		});

		it('rejects a matching key on a different kind of roll', () => {
			const rule = createRule({ checkType: 'savingThrow', saves: ['will'] });
			expect(rule.matchesRoll('abilityCheck', 'will')).toBe(false);
		});

		it('matches every save under the "all" sentinel', () => {
			const rule = createRule({ checkType: 'savingThrow', saves: ['all'] });
			expect(rule.matchesRoll('savingThrow', 'will')).toBe(true);
			expect(rule.matchesRoll('savingThrow', 'dexterity')).toBe(true);
		});

		it('rejects a roll with no target key unless the list is "all"', () => {
			expect(createRule({ saves: ['will'] }).matchesRoll('savingThrow', undefined)).toBe(false);
			expect(createRule({ saves: ['all'] }).matchesRoll('savingThrow', undefined)).toBe(true);
		});

		it('rejects every roll when the target list is empty', () => {
			const rule = createRule({ checkType: 'skillCheck', skills: [] });
			expect(rule.matchesRoll('skillCheck', 'stealth')).toBe(false);
		});

		it('reads the ability list for ability checks', () => {
			const rule = createRule({ checkType: 'abilityCheck', abilities: ['strength'] });
			expect(rule.matchesRoll('abilityCheck', 'strength')).toBe(true);
			expect(rule.matchesRoll('abilityCheck', 'will')).toBe(false);
		});

		it('reads the skill list for skill checks', () => {
			const rule = createRule({ checkType: 'skillCheck', skills: ['stealth'] });
			expect(rule.matchesRoll('skillCheck', 'stealth')).toBe(true);
			expect(rule.matchesRoll('skillCheck', 'perception')).toBe(false);
		});

		it('matches initiative regardless of target key, having none to name', () => {
			const rule = createRule({ checkType: 'initiative' });
			expect(rule.matchesRoll('initiative', undefined)).toBe(true);
		});

		it('rejects initiative rolls for a rule scoped to another check type', () => {
			const rule = createRule({ checkType: 'savingThrow', saves: ['all'] });
			expect(rule.matchesRoll('initiative', undefined)).toBe(false);
		});
	});
});
