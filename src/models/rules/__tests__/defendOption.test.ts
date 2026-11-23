import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { DefendOptionRule } from '../defendOption.js';

function makeRule(config: Record<string, unknown> = {}) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getRollData: () => ({ key: 3, auraReach: 6 }),
	};
	const item = {
		isEmbedded: true,
		actor,
		name: 'Feature',
		uuid: 'Actor.hero.Item.burst',
		getDomain: () => new Set<string>(),
	};
	const rule = new DefendOptionRule({ type: 'defendOption' } as never, {
		parent: item as unknown as foundry.abstract.DataModel.Any,
		strict: false,
	});
	Object.assign(rule, {
		disabled: false,
		predicate: new Predicate({}),
		chargePoolIdentifier: '',
		chargeCost: 1,
		actionCost: 0,
		manaCost: 0,
		woundCost: 0,
		armorBonus: '',
		...config,
	});
	Object.defineProperty(rule, 'parent', { get: () => item, configurable: true });
	Object.defineProperty(rule, 'actor', { get: () => actor, configurable: true });
	return rule;
}

describe('DefendOptionRule', () => {
	it('starts as a tick with Defend, against any attack, armor only', () => {
		const schema = DefendOptionRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown }
		>;
		expect(schema.way?.initial).toBe('withDefend');
		expect(schema.attackDelivery?.initial).toBe('any');
		expect(schema.outcome?.initial).toBe('none');
	});

	it('resolves its armor bonus from the formula, and 0 when empty', () => {
		expect(makeRule({ armorBonus: '@key + 1' }).resolveArmorBonus()).toBe(4);
		expect(makeRule({ armorBonus: '' }).resolveArmorBonus()).toBe(0);
	});

	it('never gives a negative armor bonus', () => {
		expect(makeRule({ armorBonus: '-2' }).resolveArmorBonus()).toBe(0);
	});

	it('costs what its fields say, with no heroic reaction', () => {
		const cost = makeRule({
			chargePoolIdentifier: 'sand',
			chargeCost: 0,
			actionCost: 1,
			manaCost: 2,
			woundCost: 1,
		}).optionCost;
		expect(cost).toEqual({
			chargePoolIdentifier: 'sand',
			chargeCost: 1,
			dicePoolIdentifier: '',
			manaCost: 2,
			woundCost: 1,
			actionCost: 1,
			heroicReaction: '',
		});
	});

	it('resolves its range from the formula, and never less than 1', () => {
		expect(makeRule({ range: '@auraReach' }).resolveRange()).toBe(6);
		expect(makeRule({ range: '4' }).resolveRange()).toBe(4);
		expect(makeRule({ range: '' }).resolveRange()).toBe(1);
	});

	it('limits a once-per-turn option with one key for every option on its item', () => {
		const slipstream = makeRule({ oncePerTurn: true }).optionCost;
		const whirl = makeRule({ id: 'other', oncePerTurn: true }).optionCost;
		expect(slipstream.turnUseKey).toBe('Actor.hero.Item.burst:oncePerTurn');
		expect(whirl.turnUseKey).toBe(slipstream.turnUseKey);
		expect(makeRule().optionCost.turnUseKey).toBeUndefined();
	});

	it('offers no move when the distance is empty', () => {
		expect(makeRule().moveOffer()).toBeNull();
		expect(makeRule({ moveDistance: '   ', moveDirection: 'away' }).moveOffer()).toBeNull();
	});

	it('offers the distance and direction, and any when the direction is not one', () => {
		expect(
			makeRule({ moveDistance: 'floor(@speed / 2)', moveDirection: 'away' }).moveOffer(),
		).toEqual({ distance: 'floor(@speed / 2)', direction: 'away' });
		expect(makeRule({ moveDistance: '2', moveDirection: 'sideways' }).moveOffer()).toEqual({
			distance: '2',
			direction: 'any',
		});
	});

	it('hides the direction until there is a distance', () => {
		const schema = DefendOptionRule.defineSchema() as unknown as Record<
			string,
			{ initial?: unknown; options?: { showWhen?: (data: Record<string, unknown>) => boolean } }
		>;
		expect(schema.moveDistance?.initial).toBe('');
		expect(schema.moveDirection?.initial).toBe('any');
		const show = schema.moveDirection?.options?.showWhen;
		expect(show?.({ moveDistance: '' })).toBe(false);
		expect(show?.({ moveDistance: '  ' })).toBe(false);
		expect(show?.({ moveDistance: 'floor(@speed / 2)' })).toBe(true);
	});
});
