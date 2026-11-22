import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { collectGrantedActionOffers } from '#utils/combat/grantedActionOffers.js';
import { collectOfferBonuses } from '#utils/damage/collectOfferBonuses.js';
import { Predicate } from '../../../etc/Predicate.js';
import { AttackRollModeRule } from '../attackRollMode.js';
import { OfferAttackBonusRule } from '../offerAttackBonus.js';

const COMMANDER = 'packs/classFeatures/core/commander';
const JUGGERNAUT = `${COMMANDER}/commander-subclasses/champion-of-the-bulwark/juggernaut.json`;
const COORDINATED_STRIKE = `${COMMANDER}/commanders-order/coordinated-strike.json`;
const WITHERING_STRIKE = `${COMMANDER}/commander-subclasses/spellblade/withering-strike.json`;
const MASTER_COMMANDER = `${COMMANDER}/commander-progression/master-commander.json`;
const AS_ONE = `${COMMANDER}/commander-subclasses/champion-of-the-vanguard/as-one.json`;
const readItem = (file: string) => JSON.parse(readFileSync(resolve(file), 'utf8'));

function juggernaut(): OfferAttackBonusRule {
	return offerRuleOf(readItem(JUGGERNAUT).system.rules[0], 'Juggernaut', 5);
}

function offerRuleOf(data: Record<string, unknown>, name: string, resolved: number) {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getRollData: () => ({ attributes: { armor: { value: 5 } } }),
	};
	const parent = {
		isEmbedded: true,
		actor,
		name,
		uuid: 'Item.j',
		getDomain: () => new Set<string>(),
	};
	const rule = new OfferAttackBonusRule(
		{ type: data.type } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { ...data, predicate: new Predicate({}), resolveFormula: () => resolved });
	Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
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
			itemUuid: 'Item.j',
			damage: 5,
			primaryDie: 1,
		});
	});

	it('adds nothing on another attack', () => {
		expect(juggernaut().bonusFor(undefined)).toBeNull();
		expect(juggernaut().bonusFor('other-item')).toBeNull();
	});

	it('adds nothing when no item is named', () => {
		const rule = juggernaut();
		rule.offerSource = '';
		expect(rule.bonusFor('coordinated-strike')).toBeNull();
		expect(rule.bonusFor(undefined)).toBeNull();
	});

	it('collects nothing with Feature Effects off', () => {
		vi.stubGlobal('game', { settings: { get: () => false } });
		expect(collectOfferBonuses({ rules: [juggernaut()] }, 'coordinated-strike')).toEqual([]);
	});

	it('gives a row with Feature Effects off, only on the attack from the offer', () => {
		vi.stubGlobal('game', { settings: { get: () => false } });
		const attack = (origin?: string) => ({
			side: 'roller' as const,
			other: null,
			roll: { kind: 'attack' as const, delivery: null, ...(origin ? { origin } : {}) },
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

	it('gives a line to each targeted ally, so a second ally (Experienced Commander) gets one too', () => {
		const offers = collectGrantedActionOffers(item(rule.includesUser), [
			{ actor: { uuid: 'Actor.ally' } },
			{ actor: { uuid: 'Actor.second' } },
		]);
		expect(offers.map((offer) => offer.targetActorUuid)).toEqual([
			'Actor.hero',
			'Actor.ally',
			'Actor.second',
		]);
	});

	it('does not give the user a row from a rule that does not say so', () => {
		const offers = collectGrantedActionOffers(item(false), [{ actor: { uuid: 'Actor.hero' } }]);
		expect(offers).toEqual([]);
	});
});

describe('Withering Strike', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	const item = readItem(WITHERING_STRIKE);
	const rulesOf = (type: string) =>
		item.system.rules.filter((rule: { type: string }) => rule.type === type);
	const necrotic = () => offerRuleOf(rulesOf('offerAttackBonus')[0], 'Withering Strike', 8);

	it('adds necrotic damage equal to the max of the Combat Die, only on a Coordinated Strike attack', () => {
		expect(rulesOf('offerAttackBonus')[0].damage).toBe('@pools.combat-dice.faces');
		expect(necrotic().bonusFor('coordinated-strike')).toEqual({
			label: 'Withering Strike',
			damage: 8,
			primaryDie: 0,
			damageType: 'necrotic',
		});
		expect(necrotic().bonusFor(undefined)).toBeNull();
	});

	it('gives no row with Feature Effects off, as a row cannot add damage of its own type', () => {
		vi.stubGlobal('game', { settings: { get: () => false } });
		expect(
			necrotic().offersUseOn({
				side: 'roller',
				other: null,
				roll: { kind: 'attack', delivery: null, origin: 'coordinated-strike' },
			}),
		).toBe(false);
	});

	it('makes a creature it hits or crits considered undead for 1 round, only on a Coordinated Strike attack', () => {
		const effect = item.effects.find((each: { _id: string }) => each._id === 'ek1iEr1yAJm5bkIe');
		expect(effect.system.rules[0].tags).toEqual(['target:undead']);
		expect(effect.system.lastsUntil[0]).toMatchObject({ kind: 'time', value: 1, units: 'rounds' });
		const marks = rulesOf('applyCondition');
		expect(marks.map((rule: { trigger: string }) => rule.trigger)).toEqual(['onHit', 'onCrit']);
		for (const rule of marks) {
			expect(rule).toMatchObject({ effectId: effect._id, attackOrigin: 'coordinated-strike' });
		}
		expect(item.system.activation.effects).toEqual([]);
	});
});

describe('Master Commander and As One!', () => {
	function rollModeRule(file: string, name: string) {
		const data = readItem(file).system.rules.find(
			(rule: { type: string }) => rule.type === 'attackRollMode',
		);
		const parent = {
			isEmbedded: true,
			actor: { uuid: 'Actor.hero', getDomain: () => new Set<string>() },
			name,
			uuid: 'Item.r',
			getDomain: () => new Set<string>(),
		};
		const rule = new AttackRollModeRule(
			{ type: 'attackRollMode' } as never,
			{ parent, strict: false } as never,
		);
		Object.assign(rule, { ...data, predicate: new Predicate({}) });
		Object.defineProperty(rule, 'parent', { get: () => parent, configurable: true });
		return rule;
	}

	it('Master Commander: a Coordinated Strike attack ignores disadvantage', () => {
		const rule = rollModeRule(MASTER_COMMANDER, 'Master Commander');
		expect(rule.changeFor('coordinated-strike')).toEqual({
			advantage: 0,
			ignoreDisadvantage: true,
			label: 'Master Commander',
		});
		expect(rule.changeFor(undefined)).toBeNull();
	});

	it('As One!: a Coordinated Strike attack has advantage and ignores all disadvantage', () => {
		const rule = rollModeRule(AS_ONE, 'As One!');
		expect(rule.changeFor('coordinated-strike')).toEqual({
			advantage: 1,
			ignoreDisadvantage: true,
			label: 'As One!',
		});
		expect(rule.changeFor('other-feature')).toBeNull();
	});
});
