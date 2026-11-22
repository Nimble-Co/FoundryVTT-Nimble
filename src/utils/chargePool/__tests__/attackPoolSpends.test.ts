import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { IncomingReactionEntry } from '../../incomingReactions/incomingReactionEntry.js';
import { spendsPoolAgain } from '../attackPoolSpends.js';

/**
 * One spend of a charge pool per attack: what the attack spent when it was made
 * (the card's charge record) and what its own card entries spent since.
 */

const POOL_RULE = {
	type: 'chargePool',
	id: 'combat-dice-pool',
	identifier: 'combat-dice',
	label: 'Combat Dice',
	disabled: false,
	scope: 'item',
	max: '3',
	dieSize: 'd8',
	initial: 'max',
	recoveries: [],
};

const ACTOR_UUID = 'Actor.commander';

function feature(id: string, rule: Record<string, unknown>) {
	return {
		id,
		uuid: `${ACTOR_UUID}.Item.${id}`,
		flags: {},
		rules: new Map([[String(rule.id), { disabled: false, ...rule }]]),
	};
}

const pools = {
	id: 'fit',
	uuid: `${ACTOR_UUID}.Item.fit`,
	flags: { [SYSTEM_ID]: { chargePools: { 'combat-dice': { current: 2, max: 3, seeded: true } } } },
	rules: new Map([['combat-dice-pool', POOL_RULE]]),
};
const heavy = feature('heavy', {
	type: 'chargeConsumer',
	id: 'heavy-spend',
	poolIdentifier: 'combat-dice',
	cardOffer: 'hit',
});
const inerrant = feature('inerrant', {
	type: 'reroll',
	id: 'inerrant-reroll',
	chargePoolIdentifier: 'combat-dice',
});
const wily = feature('wily', { type: 'reroll', id: 'wily-reroll', chargePoolIdentifier: 'wily' });
const items = [pools, heavy, inerrant, wily];

const actor = {
	uuid: ACTOR_UUID,
	type: 'character',
	flags: {},
	items: { contents: items, get: (id: string) => items.find((item) => item.id === id) },
	getRollData: () => ({}),
};

function entry(overrides: Partial<IncomingReactionEntry>): IncomingReactionEntry {
	return {
		id: 'entry',
		kind: 'spendPoolForDamage',
		source: 'rule',
		actorUuid: ACTOR_UUID,
		tokenUuid: null,
		targetTokenUuid: null,
		label: '',
		ruleId: '',
		itemUuid: '',
		used: false,
		...overrides,
	} as IncomingReactionEntry;
}

const heavyEntry = entry({ id: 'heavy', ruleId: 'heavy-spend', itemUuid: heavy.uuid });
const inerrantEntry = entry({
	id: 'inerrant',
	kind: 'reroll',
	side: 'roller',
	ruleId: 'inerrant-reroll',
	itemUuid: inerrant.uuid,
});
const spentAtUse = { poolId: 'combat-dice', change: -1 };

beforeEach(() => {
	(globalThis as Record<string, unknown>).fromUuidSync = vi.fn((uuid: string) => {
		return items.find((item) => item.uuid === uuid) ?? (uuid === ACTOR_UUID ? actor : null);
	});
});

describe('spendsPoolAgain', () => {
	it('lets the first spend of a pool on an attack through', () => {
		expect(spendsPoolAgain(heavyEntry, { consumption: [], entries: [heavyEntry] })).toBe(false);
	});

	it('stops a card spend from a pool the attack spent from in the roll window', () => {
		expect(spendsPoolAgain(heavyEntry, { consumption: [spentAtUse], entries: [heavyEntry] })).toBe(
			true,
		);
	});

	it('stops a reroll that spends from a pool the attack spent from in the roll window', () => {
		expect(
			spendsPoolAgain(inerrantEntry, { consumption: [spentAtUse], entries: [inerrantEntry] }),
		).toBe(true);
	});

	it('stops a card spend after a reroll on the card spent from the same pool', () => {
		const usedReroll = { ...inerrantEntry, used: true };
		expect(
			spendsPoolAgain(heavyEntry, { consumption: [], entries: [usedReroll, heavyEntry] }),
		).toBe(true);
	});

	it('counts only what the record spent, not a refill or another pool', () => {
		const refill = { poolId: 'combat-dice', change: 1 };
		const otherPool = { poolId: 'thrill', change: -1 };
		expect(
			spendsPoolAgain(heavyEntry, { consumption: [refill, otherPool], entries: [heavyEntry] }),
		).toBe(false);
	});

	it('lets a spend from another pool through', () => {
		const wilyEntry = { ...inerrantEntry, id: 'wily', ruleId: 'wily-reroll', itemUuid: wily.uuid };
		expect(spendsPoolAgain(wilyEntry, { consumption: [spentAtUse], entries: [wilyEntry] })).toBe(
			false,
		);
	});

	it('leaves alone a reroll another creature makes from its own pool', () => {
		const targetReroll = { ...inerrantEntry, side: 'target' as const };
		expect(
			spendsPoolAgain(targetReroll, { consumption: [spentAtUse], entries: [targetReroll] }),
		).toBe(false);
	});
});
