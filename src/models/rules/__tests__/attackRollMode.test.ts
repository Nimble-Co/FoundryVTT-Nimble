import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { AttackRollModeRule } from '../attackRollMode.js';

function makeRule(
	config: Record<string, unknown> = {},
	options: { isEmbedded?: boolean; tags?: string[] } = {},
) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(options.tags ?? []),
		getFlag: () => undefined,
		getRollData: () => ({}),
	};
	const item = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: 'Steady Hands',
		uuid: 'Actor.hero.Item.steady',
		getDomain: () => new Set<string>(),
	};
	const rule = new AttackRollModeRule({ type: 'attackRollMode' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		label: '',
		advantage: 0,
		ignoreDisadvantage: false,
		attackOrigin: '',
		attackKind: 'any',
		predicate: new Predicate({}),
		...config,
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	return rule;
}

describe('AttackRollModeRule', () => {
	it('defines its fields with their defaults', () => {
		const schema = AttackRollModeRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.advantage?.initial).toBe(0);
		expect(schema.ignoreDisadvantage?.initial).toBe(false);
		expect(schema.attackOrigin?.initial).toBe('');
		expect(schema.attackKind?.initial).toBe('any');
		expect(AttackRollModeRule.group).toBe('bonuses');
	});

	it('gives its advantage and ignores disadvantage on an attack made through its feature', () => {
		const rule = makeRule({ advantage: 1, ignoreDisadvantage: true, attackOrigin: 'rally' });
		expect(rule.changeFor('rally')).toEqual({
			advantage: 1,
			ignoreDisadvantage: true,
			label: 'Steady Hands',
		});
	});

	it('gives nothing to an attack made another way', () => {
		const rule = makeRule({ advantage: 1, attackOrigin: 'rally' });
		expect(rule.changeFor('other-feature')).toBeNull();
		expect(rule.changeFor(undefined)).toBeNull();
	});

	it('takes every attack when the field is blank', () => {
		expect(makeRule({ ignoreDisadvantage: true }).changeFor(undefined)).toEqual({
			advantage: 0,
			ignoreDisadvantage: true,
			label: 'Steady Hands',
		});
	});

	it('gives nothing when it changes nothing, while its predicate fails, while disabled, or off an actor', () => {
		expect(makeRule({}).changeFor(undefined)).toBeNull();
		const raging = { advantage: 1, predicate: new Predicate({ self: 'raging' }) };
		expect(makeRule(raging).changeFor(undefined)).toBeNull();
		expect(makeRule(raging, { tags: ['self:raging'] }).changeFor(undefined)).not.toBeNull();
		expect(makeRule({ advantage: 1, disabled: true }).changeFor(undefined)).toBeNull();
		expect(makeRule({ advantage: 1 }, { isEmbedded: false }).changeFor(undefined)).toBeNull();
	});

	it('changes only opportunity attacks when it is for them', () => {
		const rule = makeRule({ advantage: 1, attackKind: 'opportunity' });
		expect(rule.changeFor(undefined)).toBeNull();
		expect(rule.changeFor(undefined, { opportunityAttack: false })).toBeNull();
		expect(rule.changeFor(undefined, { opportunityAttack: true })).toEqual({
			advantage: 1,
			ignoreDisadvantage: false,
			label: 'Steady Hands',
		});
	});

	it('changes opportunity attacks too when it is for every attack', () => {
		expect(makeRule({ advantage: 1 }).changeFor(undefined, { opportunityAttack: true })).not.toBe(
			null,
		);
	});
});
