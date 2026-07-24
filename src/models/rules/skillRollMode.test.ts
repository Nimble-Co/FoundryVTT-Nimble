import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SkillRollModeRule } from './skillRollMode.js';

interface MockSkill {
	defaultRollMode?: number;
	[key: string]: unknown;
}

interface MockActor {
	system: {
		skills?: Record<string, MockSkill>;
	};
	getDomain: () => string[];
}

interface MockItem {
	isEmbedded: boolean;
	actor: MockActor;
	name: string;
	uuid: string;
	getDomain: () => string[];
}

interface SkillRollModeRuleTestInstance extends SkillRollModeRule {
	value: number;
	skills: string[];
	mode: 'set' | 'adjust';
	disabled: boolean;
	label: string;
}

function createMockActor(skills: Record<string, MockSkill> | undefined): MockActor {
	return {
		system: { skills },
		getDomain: () => [],
	};
}

function createMockItem(actor: MockActor, isEmbedded = true): MockItem {
	return {
		isEmbedded,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: () => [],
	};
}

function createSkillRollModeRule(
	config: {
		value: number;
		skills: string[];
		mode?: 'set' | 'adjust';
		disabled?: boolean;
		predicate?: { size: number; test: (domain: Set<string>) => boolean };
	},
	actor: MockActor,
	itemOptions?: { isEmbedded?: boolean },
): SkillRollModeRuleTestInstance {
	const item = createMockItem(actor, itemOptions?.isEmbedded ?? true);

	const sourceData = {
		value: config.value,
		skills: config.skills,
		mode: config.mode ?? 'adjust',
		disabled: config.disabled ?? false,
		label: 'Test Rule',
		id: 'test-rule-id',
		identifier: '',
		priority: 1,
		predicate: {},
		type: 'skillRollMode',
	};

	const rule = new SkillRollModeRule(
		sourceData as foundry.data.fields.SchemaField.CreateData<SkillRollModeRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as SkillRollModeRuleTestInstance;

	// Manually set properties since the mock DataModel doesn't do this automatically
	rule.value = config.value;
	rule.skills = config.skills;
	rule.mode = config.mode ?? 'adjust';
	rule.disabled = config.disabled ?? false;

	Object.defineProperty(rule, 'item', {
		get: () => item,
		configurable: true,
	});

	Object.defineProperty(rule, 'actor', {
		get: () => item.actor,
		configurable: true,
	});

	Object.defineProperty(rule, '_predicate', {
		get: () => config.predicate ?? { size: 0 },
		configurable: true,
	});

	return rule;
}

describe('SkillRollModeRule', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('afterPrepareData', () => {
		it('should apply advantage to the targeted skill', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(1);
		});

		it('should stack multiple adjust rules', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });

			createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor).afterPrepareData();
			createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor).afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(2);
		});

		it('should apply disadvantage for negative values', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule({ value: -2, skills: ['stealth'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(-2);
		});

		it('should cancel advantage and disadvantage per instance when adjusting', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 2 } });
			const rule = createSkillRollModeRule({ value: -1, skills: ['stealth'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(1);
		});

		it('should override the current roll mode in set mode', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 3 } });
			const rule = createSkillRollModeRule({ value: 1, skills: ['stealth'], mode: 'set' }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(1);
		});

		it('should let adjust rules stack on top of an earlier set rule', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });

			createSkillRollModeRule({ value: 2, skills: ['stealth'], mode: 'set' }, actor) //
				.afterPrepareData();
			createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor).afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(3);
		});

		it('should apply to every skill when skills includes "all"', () => {
			const skills = Object.fromEntries(
				Object.keys(CONFIG.NIMBLE.skills).map((key) => [key, { defaultRollMode: 0 }]),
			);
			const actor = createMockActor(skills);
			const rule = createSkillRollModeRule({ value: 1, skills: ['all'] }, actor);

			rule.afterPrepareData();

			for (const skill of Object.values(actor.system.skills ?? {})) {
				expect(skill.defaultRollMode).toBe(1);
			}
		});

		it('should only modify the targeted skills', () => {
			const actor = createMockActor({
				stealth: { defaultRollMode: 0 },
				perception: { defaultRollMode: 0 },
			});
			const rule = createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.perception.defaultRollMode).toBe(0);
		});

		it('should do nothing when skills is empty', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule({ value: 1, skills: [] }, actor);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(0);
		});

		it('should do nothing for non-embedded items', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor, {
				isEmbedded: false,
			});

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(0);
		});

		it('should not throw for actors without skills', () => {
			const actor = createMockActor(undefined);
			const rule = createSkillRollModeRule({ value: 1, skills: ['stealth'] }, actor);

			expect(() => rule.afterPrepareData()).not.toThrow();
		});

		it('should do nothing when the rule is disabled', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule(
				{ value: 1, skills: ['stealth'], disabled: true },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(0);
		});

		it('should do nothing when the predicate fails', () => {
			const actor = createMockActor({ stealth: { defaultRollMode: 0 } });
			const rule = createSkillRollModeRule(
				{ value: 1, skills: ['stealth'], predicate: { size: 1, test: () => false } },
				actor,
			);

			rule.afterPrepareData();

			expect(actor.system.skills?.stealth.defaultRollMode).toBe(0);
		});
	});

	describe('schema', () => {
		it('should define the correct schema fields', () => {
			const schema = SkillRollModeRule.defineSchema();

			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('skills');
			expect(schema).toHaveProperty('mode');
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('disabled');
			expect(schema).toHaveProperty('label');
		});

		it('declares closed mode choice set defaulting to adjust', () => {
			const schema = SkillRollModeRule.defineSchema();
			const mode = schema.mode as unknown as { choices: string[]; options: { initial: string } };

			expect(mode.choices).toEqual(['set', 'adjust']);
			expect(mode.options.initial).toBe('adjust');
		});

		it('offers every configured skill plus the "all" sentinel', () => {
			const schema = SkillRollModeRule.defineSchema();
			const skills = schema.skills as unknown as {
				element: { options: { choices: () => string[] } };
			};
			const choices = skills.element.options.choices();

			expect(choices).toContain('all');
			expect(choices).toContain('arcana');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SkillRollModeRule.group).toBe('bonuses');
			expect(SkillRollModeRule.description).toBe('NIMBLE.rules.skillRollMode.description');
		});
	});
});
