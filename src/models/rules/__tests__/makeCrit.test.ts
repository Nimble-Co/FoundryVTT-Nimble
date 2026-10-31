import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { MakeCritRule } from '../makeCrit.js';

type FieldLike = {
	initial?: unknown;
	label?: string;
	options?: { label?: string; hint?: string };
	hint?: string;
};

const schema = MakeCritRule.defineSchema() as unknown as Record<string, FieldLike>;

function makeRule(config: Record<string, unknown> = {}) {
	const actor = {
		uuid: 'Actor.beast',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Unleash the Beast',
		uuid: 'Actor.beast.Item.unleash',
		getDomain: () => new Set<string>(),
	};
	const rule = new MakeCritRule({ type: 'makeCrit' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		usedBy: 'roller',
		outcome: 'miss',
		attackDelivery: 'any',
		otherCreature: new Predicate({}),
		predicate: new Predicate({}),
		chargePoolIdentifier: '',
		chargeCost: 1,
		manaCost: 0,
		woundCost: 0,
		heroicReaction: '',
		actionCost: 0,
		...config,
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

describe('MakeCritRule', () => {
	it('has the shared who, when and cost fields, and no roll or die fields', () => {
		for (const name of ['usedBy', 'reach', 'outcome', 'attackDelivery', 'otherCreature']) {
			expect(schema[name], name).toBeTruthy();
		}
		for (const name of ['chargePoolIdentifier', 'chargeCost', 'oncePerAttack', 'cardHint']) {
			expect(schema[name], name).toBeTruthy();
		}
		for (const name of ['rolls', 'saves', 'skills', 'abilities', 'die', 'keep']) {
			expect(schema[name], name).toBeUndefined();
		}
		expect(schema.type?.initial).toBe('makeCrit');
	});

	it('uses its own words where the Reroll words say reroll', () => {
		const field = (name: string) => schema[name]?.options ?? schema[name];
		expect(field('oncePerAttack')?.label).toBe('NIMBLE.rules.makeCrit.oncePerAttack.label');
		expect(field('chargeCost')?.hint).toBe('NIMBLE.rules.makeCrit.chargeCost.hint');
		expect(field('usedBy')?.label).toBe('NIMBLE.rules.reroll.usedBy.label');
	});

	it('offers on attacks only, on the side it names', () => {
		const rule = makeRule();
		const attack = { kind: 'attack', delivery: 'melee' } as const;
		expect(rule.offersUseOn({ side: 'roller', roll: attack })).toBe(true);
		expect(rule.offersUseOn({ side: 'target', roll: attack })).toBe(false);
		expect(rule.offersUseOn({ side: 'roller', roll: { kind: 'save', key: 'strength' } })).toBe(
			false,
		);
	});

	it('offers to the target when it is on the target side', () => {
		const rule = makeRule({ usedBy: 'target', attackDelivery: 'melee' });
		expect(rule.offersUseOn({ side: 'target', roll: { kind: 'attack', delivery: 'melee' } })).toBe(
			true,
		);
		expect(rule.offersUseOn({ side: 'target', roll: { kind: 'attack', delivery: 'ranged' } })).toBe(
			false,
		);
	});
});
