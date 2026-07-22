import { describe, expect, it, vi } from 'vitest';
import { SkillBonusRule } from './skillBonus.js';

interface MockActor {
	system: { skills: Record<string, { bonus: number }> };
	getRollData: () => Record<string, unknown>;
	getDomain: () => string[];
}

function createRule(
	config: {
		value: string;
		skills: string[];
		predicate?: { size: number; test: (domain: Set<string>) => boolean };
	},
	actor: MockActor,
	isEmbedded = true,
) {
	const item = {
		isEmbedded,
		actor,
		name: 'Test Item',
		uuid: 'test-item-uuid',
		getDomain: () => [],
	};

	const rule = new SkillBonusRule(
		{
			value: config.value,
			skills: config.skills,
			disabled: false,
			label: 'Test Rule',
			id: 'test-rule-id',
			identifier: '',
			priority: 1,
			predicate: {},
			type: 'skillBonus',
		} as foundry.data.fields.SchemaField.CreateData<SkillBonusRule['schema']['fields']>,
		{ parent: item as unknown as foundry.abstract.DataModel.Any, strict: false },
	) as SkillBonusRule & { value: string; skills: string[]; disabled: boolean };

	rule.value = config.value;
	rule.skills = config.skills;
	rule.disabled = false;

	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => item.actor, configurable: true });
	Object.defineProperty(rule, '_predicate', {
		get: () => config.predicate ?? { size: 0 },
		configurable: true,
	});

	return rule;
}

function createMockActor(): MockActor {
	return {
		system: { skills: { stealth: { bonus: 0 } } },
		getRollData: vi.fn(() => ({})),
		getDomain: () => [],
	};
}

describe('SkillBonusRule', () => {
	describe('prePrepareData', () => {
		it('applies the bonus when the predicate passes', () => {
			const actor = createMockActor();
			createRule({ value: '2', skills: ['stealth'] }, actor).prePrepareData();

			expect(actor.system.skills.stealth.bonus).toBe(2);
		});

		it('does nothing when the predicate fails', () => {
			const actor = createMockActor();
			createRule(
				{ value: '2', skills: ['stealth'], predicate: { size: 1, test: () => false } },
				actor,
			).prePrepareData();

			expect(actor.system.skills.stealth.bonus).toBe(0);
		});
	});

	describe('schema', () => {
		it('defines the expected fields', () => {
			const schema = SkillBonusRule.defineSchema();
			expect(schema).toHaveProperty('type');
			expect(schema).toHaveProperty('value');
			expect(schema).toHaveProperty('skills');
		});

		it('declares choices on skills array (with `all` sentinel)', () => {
			const schema = SkillBonusRule.defineSchema();
			const arrayField = schema.skills as unknown as { element: { choices: () => string[] } };
			const choices = arrayField.element.choices();
			expect(choices).toContain('all');
			expect(choices).toContain('arcana');
		});
	});

	describe('class metadata', () => {
		it('exposes the picker group and i18n description key', () => {
			expect(SkillBonusRule.group).toBe('bonuses');
			expect(SkillBonusRule.description).toBe('NIMBLE.rules.skillBonus.description');
		});
	});
});
