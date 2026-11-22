import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	originOfCard,
	originOwnerRules,
	reachesOthersAttacks,
	ruleReachesAttack,
	rulesReachingAttack,
} from '../attackOrigin.js';

const globals = globalThis as Record<string, unknown>;

interface TestRule {
	id: string;
	type: string;
	originAttacker?: string;
	originScope?: string;
	actor?: unknown;
}

function creature(uuid: string, rules: TestRule[] = []) {
	const actor = { uuid, rules };
	for (const rule of rules) rule.actor = actor;
	return actor;
}

const rule = (id: string, type: string, originAttacker: string, originScope = 'rally') => ({
	id,
	type,
	originAttacker,
	originScope,
});

describe('the rules that reach an attack', () => {
	let saved: unknown;
	const owner = creature('Actor.owner', [
		rule('anyone', 'offerAttackBonus', 'anyone'),
		rule('self', 'offerAttackBonus', 'self'),
		rule('blank', 'offerAttackBonus', 'anyone', ''),
		rule('mode', 'attackRollMode', 'anyone'),
	]);
	const ally = creature('Actor.ally', [rule('own', 'offerAttackBonus', 'self', '')]);
	const ownerItem = { uuid: 'Actor.owner.Item.rally', actor: owner };
	const allyItem = { uuid: 'Actor.ally.Item.rally', actor: ally };
	const through = { uuid: ownerItem.uuid, identifier: 'rally' };
	const ids = (rules: Array<{ id?: string }>) => rules.map((each) => each.id);

	beforeEach(() => {
		saved = globals.fromUuidSync;
		globals.fromUuidSync = (uuid: string) =>
			[ownerItem, allyItem].find((item) => item.uuid === uuid) ?? null;
	});

	afterEach(() => {
		globals.fromUuidSync = saved;
	});

	it('a rule reaches others only with You and allies and a scope', () => {
		expect(reachesOthersAttacks(rule('a', 'x', 'anyone'))).toBe(true);
		expect(reachesOthersAttacks(rule('a', 'x', 'self'))).toBe(false);
		expect(reachesOthersAttacks(rule('a', 'x', 'anyone', ' '))).toBe(false);
		expect(reachesOthersAttacks({ originScope: 'rally' })).toBe(false);
	});

	it("gives the opted-in rules of the item's owner to an ally's attack through it", () => {
		expect(ids(originOwnerRules(ally, through))).toEqual(['anyone', 'mode']);
	});

	it("gives none to the owner's own attack, nor to an attack through the ally's item", () => {
		expect(originOwnerRules(owner, through)).toEqual([]);
		expect(originOwnerRules(ally, { uuid: allyItem.uuid, identifier: 'rally' })).toEqual([]);
	});

	it('gives none with no origin, or an origin item that is not found', () => {
		expect(originOwnerRules(ally, null)).toEqual([]);
		expect(originOwnerRules(ally, { identifier: 'rally' })).toEqual([]);
		expect(originOwnerRules(ally, { uuid: 'Item.gone', identifier: 'rally' })).toEqual([]);
	});

	it("lists the attacker's own rules of one type, then the opted-in rules of the owner", () => {
		expect(ids(rulesReachingAttack(ally, 'offerAttackBonus', through))).toEqual(['own', 'anyone']);
		expect(ids(rulesReachingAttack(ally, 'attackRollMode', through))).toEqual(['mode']);
		expect(ids(rulesReachingAttack(owner, 'offerAttackBonus', through))).toEqual([
			'anyone',
			'self',
			'blank',
		]);
	});

	it("tells if one rule reaches an attack: always the owner's, an ally's only when it opts in", () => {
		const [anyone, self] = owner.rules;
		expect(ruleReachesAttack(self, owner, through.uuid)).toBe(true);
		expect(ruleReachesAttack(self, ally, through.uuid)).toBe(false);
		expect(ruleReachesAttack(anyone, ally, through.uuid)).toBe(true);
		expect(ruleReachesAttack(anyone, ally, allyItem.uuid)).toBe(false);
		expect(ruleReachesAttack(anyone, ally, undefined)).toBe(false);
	});

	it('reads the origin a card recorded', () => {
		expect(originOfCard({ flags: { [SYSTEM_ID]: { origin: through } } })).toEqual(through);
		expect(originOfCard({ flags: {} })).toBeUndefined();
		expect(originOfCard(null)).toBeUndefined();
	});
});
