import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { PrimaryDieBonusRule } from '../primaryDieBonus.js';

function makeRule(
	config: Record<string, unknown> = {},
	options: { isEmbedded?: boolean; tags?: string[] } = {},
) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(options.tags ?? []),
		getFlag: () => undefined,
		getRollData: () => ({ level: 3 }),
	};
	const item = {
		isEmbedded: options.isEmbedded ?? true,
		actor,
		name: 'Unerring Judgment',
		uuid: 'Actor.hero.Item.judgment',
		getDomain: () => new Set<string>(),
	};
	const rule = new PrimaryDieBonusRule({ type: 'primaryDieBonus' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		value: '1',
		attackDelivery: 'any',
		otherCreature: new Predicate({}),
		predicate: new Predicate({}),
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

const ogre = (...tags: string[]) => ({ uuid: 'Actor.ogre', getTargetDomain: () => new Set(tags) });

describe('PrimaryDieBonusRule', () => {
	it('defines its fields with their defaults', () => {
		const schema = PrimaryDieBonusRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.value?.initial).toBe('1');
		expect(schema.attackDelivery?.initial).toBe('any');
		expect(schema.otherCreature).toBeTruthy();
		expect(PrimaryDieBonusRule.group).toBe('bonuses');
	});

	it('gives its value on an attack with the delivery it names', () => {
		const rule = makeRule({ value: '2', attackDelivery: 'melee' });
		expect(rule.bonusFor({ delivery: 'melee', other: ogre() })).toBe(2);
		expect(rule.bonusFor({ delivery: 'ranged', other: ogre() })).toBe(0);
	});

	it('gives its value to an attack with no attack type only when it is for any attack', () => {
		expect(makeRule({ value: '2' }).bonusFor({ delivery: null, other: null })).toBe(2);
		expect(
			makeRule({ value: '2', attackDelivery: 'melee' }).bonusFor({ delivery: null, other: null }),
		).toBe(0);
		expect(
			makeRule({ value: '2', attackDelivery: 'ranged' }).bonusFor({ delivery: null, other: null }),
		).toBe(0);
	});

	it('resolves a formula against the owner, as a whole number, and may be negative', () => {
		expect(makeRule({ value: '@level' }).bonusFor({ delivery: 'melee', other: null })).toBe(3);
		expect(makeRule({ value: '-1' }).bonusFor({ delivery: 'melee', other: null })).toBe(-1);
		expect(makeRule({ value: '3 / 2' }).bonusFor({ delivery: 'melee', other: null })).toBe(1);
	});

	it('gives nothing while its predicate fails, while disabled, or off an actor', () => {
		const rule = makeRule({ predicate: new Predicate({ self: 'pool:judgment' }) });
		expect(rule.bonusFor({ delivery: 'melee', other: null })).toBe(0);
		const withDice = makeRule(
			{ predicate: new Predicate({ self: 'pool:judgment' }) },
			{ tags: ['self:pool:judgment'] },
		);
		expect(withDice.bonusFor({ delivery: 'melee', other: null })).toBe(1);
		expect(makeRule({ disabled: true }).bonusFor({ delivery: 'melee', other: null })).toBe(0);
		expect(makeRule({}, { isEmbedded: false }).bonusFor({ delivery: 'melee', other: null })).toBe(
			0,
		);
	});

	it('tests the other creature', () => {
		const rule = makeRule({ otherCreature: new Predicate({ target: 'distracted' }) });
		expect(rule.bonusFor({ delivery: 'melee', other: ogre('target:distracted') })).toBe(1);
		expect(rule.bonusFor({ delivery: 'melee', other: ogre() })).toBe(0);
		expect(rule.bonusFor({ delivery: 'melee', other: null })).toBe(0);
	});
});
