import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { fixedChargeCostsOf } from '../../../utils/chargePool/fixedChargeCosts.js';
import { ChargeConsumerRule } from '../chargeConsumer.js';
import { ConditionalBonusRule } from '../conditionalBonus.js';

const readItem = (file: string) => JSON.parse(readFileSync(resolve('packs', file), 'utf8'));
const TACTICS = 'classFeatures/core/commander/combat-tactics';
const ruleOf = (item: { system: { rules: Array<{ type: string }> } }, type: string) =>
	item.system.rules.find((each) => each.type === type) as Record<string, unknown>;

const rollData = { strength: 3, pools: { 'combat-dice': { faces: 8 } } };

function liveRule<T>(RuleClass: new (...args: never[]) => T, data: Record<string, unknown>): T {
	const actor = {
		type: 'character',
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getRollData: () => rollData,
		rules: [],
	};
	const parent = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: 'Actor.hero.Item.pack',
		getDomain: () => new Set<string>(),
	};
	const rule = new RuleClass({ type: data.type } as never, { parent, strict: false } as never);
	Object.assign(rule as object, { ...data, predicate: new Predicate({}) });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
	return rule;
}

/** A Commander with the Combat Dice of Fit for Any Battlefield and the item. */
function commanderWith(item: { _id: string; name: string; system: { rules: object[] } }) {
	const fit = readItem(
		'classFeatures/core/commander/commander-progression/fit-for-any-battlefield.json',
	);
	const asOwned = (source: { _id: string; name: string; system: { rules: object[] } }) => ({
		id: source._id,
		name: source.name,
		flags: {},
		rules: new Map(
			source.system.rules.map((rule, index) => [String(index), { ...rule, appliesTo: () => true }]),
		),
	});
	const items = [asOwned(fit), asOwned(item)];
	const actor = {
		type: 'character',
		items: { contents: items, get: (id: string) => items.find((each) => each.id === id) },
		flags: {},
		getRollData: () => rollData,
		getDomain: () => new Set<string>(),
	};
	return { actor, item: items[1] };
}

describe('Heavy Strike', () => {
	const heavy = readItem(`${TACTICS}/heavy-strike.json`);
	const rule = () => liveRule(ChargeConsumerRule, ruleOf(heavy, 'chargeConsumer'));

	it('is a button on the attack card after a hit, spending one Combat Die for its roll', () => {
		expect(ruleOf(heavy, 'chargeConsumer')).toMatchObject({
			poolIdentifier: 'combat-dice',
			cost: '1',
			cardOffer: 'hit',
			effectFormula: '1d@pools.combat-dice.faces',
		});
		expect(rule().providesCardOffer({ delivery: 'melee' })).toBe(true);
	});

	it('pushes a Medium creature STR spaces, a Small one twice as far, a Large one half', () => {
		expect(rule().cardPush).toEqual({
			distance: '0',
			distanceBySize: {
				tiny: '@strength*2',
				small: '@strength*2',
				medium: '@strength',
				large: '@strength/2',
			},
		});
	});

	it('costs no action and no Combat Die when it is used from the sheet', () => {
		const { actor, item } = commanderWith(heavy);

		expect(heavy.system.activation.cost.type).toBe('none');
		expect(fixedChargeCostsOf(actor, item)).toEqual([]);
	});
});

describe('Lunging Strike', () => {
	const lunging = readItem(`${TACTICS}/lunging-strike.json`);
	const rule = () => liveRule(ConditionalBonusRule, ruleOf(lunging, 'conditionalBonus'));
	const roll = Roll as unknown as { replaceFormulaData?: unknown };
	let ownReplace: unknown;
	beforeEach(() => {
		ownReplace = roll.replaceFormulaData;
		roll.replaceFormulaData = (formula: string, data: Record<string, unknown>) =>
			formula.replace(/@([\w.-]+)/g, (_: string, path: string) =>
				String(foundry.utils.getProperty(data, path) ?? 0),
			);
	});
	afterEach(() => {
		roll.replaceFormulaData = ownReplace;
	});

	it('is a tick in the window of a melee weapon attack, off at first, with +1 Reach', () => {
		expect(rule().matchesAttack('melee', 'weapon')).toBe(true);
		expect(rule().matchesAttack('ranged', 'weapon')).toBe(false);
		expect(rule().startsChosen).toBe(false);
		expect(rule().offersAdvantage()).toBe(false);
		expect(rule().label).toBe('Using Lunging Strike (+1 Reach)');
	});

	it('spends one Combat Die and adds 2x its roll', () => {
		expect(rule().chargePoolIdentifier).toBe('combat-dice');
		expect(rule().resolveDamage()).toEqual({ value: null, formula: '1d8*2' });
	});

	it('costs no action when it is used from the sheet', () => {
		expect(lunging.system.activation.cost.type).toBe('none');
	});
});

describe('Inerrant Strike', () => {
	it('costs no action when it is used from the sheet', () => {
		expect(readItem(`${TACTICS}/inerrant-strike.json`).system.activation.cost.type).toBe('none');
	});
});

describe('Sweeping Strike', () => {
	it('spends one Combat Die when it is used', () => {
		const { actor, item } = commanderWith(readItem(`${TACTICS}/sweeping-strike.json`));

		expect(fixedChargeCostsOf(actor, item)).toEqual([
			{ poolId: 'combat-dice', label: 'Combat Dice', amount: 1, current: 0 },
		]);
	});
});

describe('Assist Me, My Friend!', () => {
	const assist = readItem('classFeatures/core/shepherd/sacred-graces/assist-me-my-friend.json');
	const bonus = ruleOf(assist, 'conditionalBonus');
	const pool = ruleOf(assist, 'chargePool');

	it('is a tick on a melee attack, off at first, that adds the damage of the Lifebinding Spirit', () => {
		expect(bonus).toMatchObject({
			label: 'Using Assist Me, My Friend! (1/round)',
			advantage: 0,
			damageOfItem: 'lifebinding-spirit',
			startsChosen: false,
			delivery: 'melee',
		});
	});

	it('spends a hidden use that comes back each round', () => {
		expect(bonus.chargePoolIdentifier).toBe(pool.identifier);
		expect(pool).toMatchObject({
			scope: 'item',
			max: '1',
			initial: 'max',
			hidden: true,
			recoveries: [
				{ trigger: 'onTurnStart', mode: 'refresh', value: '1' },
				{ trigger: 'encounterEnd', mode: 'refresh', value: '1' },
			],
		});
	});

	it('names the identifier of the Lifebinding Spirit of the Shepherd', () => {
		const spirit = readItem(
			'classFeatures/core/shepherd/shepherd-progression/lifebinding-spirit.json',
		);

		expect(spirit.system.identifier).toBe(bonus.damageOfItem);
	});
});
