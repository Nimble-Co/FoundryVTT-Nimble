import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { MaxDamageRule } from '../maxDamage.js';

const FEATURES = 'packs/classFeatures/core';

function liveRule(file: string): MaxDamageRule {
	const item = JSON.parse(readFileSync(resolve(FEATURES, file), 'utf8'));
	const data = item.system.rules.find((rule: { type: string }) => rule.type === 'maxDamage');
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		getRollData: () => ({}),
		items: [],
	};
	const parent = {
		isEmbedded: true,
		actor,
		name: item.name,
		uuid: 'Actor.hero.Item.pack',
		getDomain: () => new Set<string>(),
	};
	const rule = new MaxDamageRule(
		{ type: 'maxDamage' } as never,
		{ parent, strict: false } as never,
	);
	Object.assign(rule, { ...data, predicate: new Predicate(data.predicate ?? {}) });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('the Max Damage rules of the pack items', () => {
	it('Stormborn (2) covers a Wind spell, not a Fire spell, and gives a crit', () => {
		const rule = liveRule('stormshifter/stormshifter-progression/stormborn-2.json');

		expect(rule.covers({ type: 'spell', system: { school: 'wind' } })).toBe(true);
		expect(rule.covers({ type: 'spell', system: { school: 'fire' } })).toBe(false);
		expect(rule.givesCrit).toBe(true);
		expect(rule.chargePoolIdentifier).toBe('beastshift');
	});

	it('Shadow Rush is for a minion attack, with no cost, and the minion dies', () => {
		const rule = liveRule('shadowmancer/greater-invocations/shadow-rush.json');

		expect(rule.use).toBe('minionAttack');
		expect(rule.givesCrit).toBe(false);
		expect(rule.minionDies).toBe(true);
		expect(rule.chargePoolIdentifier).toBe('');
	});

	it('Powerful Healer is for healing dice on any item, with temp HP as the other choice', () => {
		const rule = liveRule('shepherd/shepherd-subclasses/luminary-of-mercy/powerful-healer.json');

		expect(rule.use).toBe('healing');
		expect(rule.tempHpChoice).toBe(true);
		expect(rule.covers({ type: 'feature' })).toBe(true);
		expect(rule.chargePoolIdentifier).toBe('powerful-healer');
	});
});
