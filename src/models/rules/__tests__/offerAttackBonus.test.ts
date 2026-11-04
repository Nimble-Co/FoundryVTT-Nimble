import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectGrantedActionOffers } from '#utils/combat/grantedActionOffers.js';
import { collectOfferBonuses } from '#utils/damage/collectOfferBonuses.js';
import { Predicate } from '../../../etc/Predicate.js';
import { OfferAttackBonusRule } from '../offerAttackBonus.js';

const COMMANDER = 'packs/classFeatures/core/commander';
const JUGGERNAUT = `${COMMANDER}/commander-subclasses/champion-of-the-bulwark/juggernaut.json`;
const COORDINATED_STRIKE = `${COMMANDER}/commanders-order/coordinated-strike.json`;
const readItem = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));

function juggernaut(): OfferAttackBonusRule {
	const [data] = readItem(JUGGERNAUT).system.rules;
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getRollData: () => ({ attributes: { armor: { value: 5 } } }),
	};
	const parent = {
		isEmbedded: true,
		actor,
		name: 'Juggernaut',
		uuid: 'Item.j',
		getDomain: () => new Set<string>(),
	};
	const rule = new OfferAttackBonusRule(
		{ type: data.type } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { ...data, predicate: new Predicate({}), resolveFormula: () => 5 });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('Juggernaut', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('has no damage node of its own', () => {
		expect(readItem(JUGGERNAUT).system.activation.effects).toEqual([]);
	});

	it('adds damage equal to armor and +1 on an attack from a Coordinated Strike row', () => {
		expect(juggernaut().bonusFor('coordinated-strike')).toEqual({
			label: 'Juggernaut',
			damage: 5,
			primaryDie: 1,
		});
	});

	it('adds nothing on another attack', () => {
		expect(juggernaut().bonusFor(undefined)).toBeNull();
		expect(juggernaut().bonusFor('other-item')).toBeNull();
	});

	it('collects nothing with Feature Effects off', () => {
		vi.stubGlobal('game', { settings: { get: () => false } });
		expect(collectOfferBonuses({ rules: [juggernaut()] }, 'coordinated-strike')).toEqual([]);
	});

	it('gives a row with Feature Effects off, only on the attack from the offer', () => {
		vi.stubGlobal('game', { settings: { get: () => false } });
		const attack = (offerSource?: string) => ({
			side: 'roller' as const,
			other: null,
			roll: { kind: 'attack' as const, delivery: null, ...(offerSource ? { offerSource } : {}) },
		});

		expect(juggernaut().offersUseOn(attack('coordinated-strike'))).toBe(true);
		expect(juggernaut().offersUseOn(attack())).toBe(false);
	});
});

describe('the offer row of Coordinated Strike', () => {
	const rule = readItem(COORDINATED_STRIKE).system.rules.find(
		(each: { type: string }) => each.type === 'grantActivation',
	);
	const item = (includesUser: boolean) => ({
		uuid: 'Item.cs',
		name: 'Coordinated Strike!',
		actor: { uuid: 'Actor.hero' },
		rules: new Map([['r', { ...rule, includesUser, appliesTo: () => true }]]),
	});

	it('shows to the user and the ally', () => {
		const offers = collectGrantedActionOffers(item(rule.includesUser), [
			{ actor: { uuid: 'Actor.ally' } },
		]);
		expect(offers.map((offer) => offer.targetActorUuid)).toEqual(['Actor.hero', 'Actor.ally']);
	});

	it('does not give the user a row from a rule that does not say so', () => {
		const offers = collectGrantedActionOffers(item(false), [{ actor: { uuid: 'Actor.hero' } }]);
		expect(offers).toEqual([]);
	});
});
