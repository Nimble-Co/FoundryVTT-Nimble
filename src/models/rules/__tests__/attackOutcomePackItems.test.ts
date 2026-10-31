import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { AttackOutcomeRule } from '../attackOutcome.js';
import { MakeCritRule } from '../makeCrit.js';

const FEATURES = 'packs/classFeatures/core';

type RuleData = Record<string, unknown> & { type: string; predicate?: object };

function packRules(file: string): RuleData[] {
	const item = JSON.parse(readFileSync(resolve(file), 'utf8'));
	return item.system.rules as RuleData[];
}

function ruleOfType(file: string, type: string): RuleData {
	const rule = packRules(file).find((candidate) => candidate.type === type);
	if (!rule) throw new Error(`${file} has no ${type} rule`);
	return rule;
}

const ITEM_UUID = 'Actor.hero.Item.pack';

/** A rule built from pack data, on an item of a hero with these tags and a charge in each pool. */
function liveRule<T extends AttackOutcomeRule | MakeCritRule>(
	RuleClass: new (...args: never[]) => T,
	data: RuleData,
	tags: string[] = [],
): T {
	const actor = {
		uuid: 'Actor.hero',
		getDomain: () => new Set(tags),
		getFlag: () => undefined,
		getRollData: () => ({}),
		items: [],
	};
	const pool = String(data.chargePoolIdentifier ?? '');
	const item = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: ITEM_UUID,
		getDomain: () => new Set<string>(),
		flags: { nimble: { chargePools: pool ? { [pool]: { current: 1 } } : {} } },
	};
	const rule = new RuleClass(
		{ type: data.type } as never,
		{
			parent: item,
			strict: false,
		} as never,
	);
	Object.assign(rule, {
		...data,
		otherCreature: new Predicate((data.otherCreature ?? {}) as never),
		predicate: new Predicate((data.predicate ?? {}) as never),
		// The charge gate has its own tests. These test what the items ask for.
		chargePoolIdentifier: '',
	});
	Object.defineProperty(rule, 'item', { get: () => item, configurable: true });
	return rule;
}

const creature = (...tags: string[]) => ({
	uuid: 'Actor.other',
	getTargetDomain: () => new Set(tags),
});

function changeOf(data: RuleData, context: Record<string, unknown>, tags: string[] = []) {
	return liveRule(AttackOutcomeRule, data, tags).changeFor({
		side: 'yourAttacks',
		delivery: 'melee',
		other: creature(),
		itemUuid: ITEM_UUID,
		damageTypes: [],
		...context,
	} as never);
}

describe('the pack items of Attack Outcome and Make It a Crit', () => {
	describe('Heads I Win, Tails You Lose', () => {
		const file = `${FEATURES}/the-cheat/the-cheat-subclasses/tools-of-the-scoundrel/heads-i-win-tails-you-lose.json`;
		const rule = ruleOfType(file, 'attackOutcome');

		it('gives "cannot miss" and crit on 1 less only while its toggle is on', () => {
			expect(changeOf(rule, {})).toBeNull();
			expect(changeOf(rule, {}, ['self:heads-i-win'])).toMatchObject({
				cannotMiss: true,
				critRange: 1,
			});
		});

		it('turns its toggle off when the round ends, and spends one use to turn it on', () => {
			expect(ruleOfType(file, 'toggleEffect')).toMatchObject({
				tags: ['self:heads-i-win'],
				turnOff: expect.arrayContaining(['onRoundEnd']),
			});
			expect(ruleOfType(file, 'chargeConsumer')).toMatchObject({ poolIdentifier: 'heads-i-win' });
			expect(ruleOfType(file, 'chargePool').recoveries).toEqual(
				expect.arrayContaining([expect.objectContaining({ trigger: 'encounterStart' })]),
			);
		});

		it('gives LVL temp HP on use', () => {
			const item = JSON.parse(readFileSync(resolve(file), 'utf8'));
			expect(item.system.activation.effects).toEqual([
				expect.objectContaining({ healingType: 'tempHealing', formula: '@level' }),
			]);
		});
	});

	describe("Deathbringer's Touch", () => {
		const rule = ruleOfType(
			`${FEATURES}/shepherd/shepherd-subclasses/luminary-of-malice/deathbringers-touch.json`,
			'attackOutcome',
		);

		it('is an "always" crit on a melee attack against a Bloodied creature', () => {
			const other = creature('target:bloodied');
			expect(changeOf(rule, { other })?.forcedCrit).toBe('always');
			expect(changeOf(rule, { other, delivery: 'ranged' })).toBeNull();
			expect(changeOf(rule, { other: creature() })).toBeNull();
		});

		it('spends its pool by itself', () => {
			expect(rule.chargePoolIdentifier).toBe('deathbringers-touch');
		});
	});

	describe('Slashing', () => {
		const rule = ruleOfType(`${FEATURES}/commander/weapon-mastery/slashing.json`, 'attackOutcome');
		const unarmored = creature('target:armor:none');

		it('cannot miss an unarmored enemy with slashing damage', () => {
			expect(changeOf(rule, { other: unarmored, damageTypes: ['slashing'] })?.cannotMiss).toBe(
				true,
			);
		});

		it('does nothing with another damage type, or against armor', () => {
			expect(changeOf(rule, { other: unarmored, damageTypes: ['piercing'] })).toBeNull();
			expect(
				changeOf(rule, { other: creature('target:armor:heavy'), damageTypes: ['slashing'] }),
			).toBeNull();
		});
	});

	describe('Gnatbane Weapon', () => {
		const rule = ruleOfType(
			'packs/magicItems/core/coreRules/gnatbane-weapon.json',
			'attackOutcome',
		);

		it('cannot miss a Small or Tiny creature, on its own attacks only', () => {
			for (const size of ['small', 'tiny']) {
				const other = creature(`target:size:${size}`);
				expect(changeOf(rule, { other })?.cannotMiss).toBe(true);
			}
			expect(changeOf(rule, { other: creature('target:size:medium') })).toBeNull();
			expect(
				changeOf(rule, { other: creature('target:size:tiny'), itemUuid: 'Actor.hero.Item.other' }),
			).toBeNull();
		});
	});

	describe('Shatter', () => {
		const rule = ruleOfType('packs/spells/core/ice/shatter.json', 'attackOutcome');

		it('crits on any die at its max against a Hampered target, on this spell only', () => {
			const other = creature('target:hampered');
			expect(changeOf(rule, { other, delivery: null })?.anyDieCrits).toBe(true);
			expect(changeOf(rule, { other: creature(), delivery: null })).toBeNull();
			expect(changeOf(rule, { other, itemUuid: 'Actor.hero.Item.other' })).toBeNull();
		});
	});

	describe('Unleash the Beast', () => {
		const file = `${FEATURES}/stormshifter/stormshifter-subclasses/circle-of-fang-and-claw/unleash-the-beast.json`;

		it('makes a miss of the one who rolled a crit, from a pool that refills each encounter', () => {
			const data = ruleOfType(file, 'makeCrit');
			expect(data).toMatchObject({ usedBy: 'roller', outcome: 'miss' });
			expect(data.chargePoolIdentifier).toBe('unleash-the-beast');
			const roll = { kind: 'attack', delivery: 'melee' } as const;
			const rule = liveRule(MakeCritRule, data);
			expect(rule.offersUseOn({ side: 'roller', roll })).toBe(true);
			expect(rule.offersUseOn({ side: 'target', roll })).toBe(false);
		});
	});

	describe('Bring the Pain', () => {
		const file = `${FEATURES}/zephyr/zephyr-subclasses/way-of-pain/bring-the-pain.json`;

		it('lets the target make a melee attack a crit', () => {
			const rule = liveRule(MakeCritRule, ruleOfType(file, 'makeCrit'));
			const offers = (delivery: 'melee' | 'ranged') =>
				rule.offersUseOn({ side: 'target', roll: { kind: 'attack', delivery } });
			expect(offers('melee')).toBe(true);
			expect(offers('ranged')).toBe(false);
		});

		it('halves the damage of a crit only', () => {
			expect(ruleOfType(file, 'damageReduction')).toMatchObject({ mode: 'half', onlyCrits: true });
		});
	});

	it('gives each rule an id of its own', () => {
		const ids = [
			`${FEATURES}/the-cheat/the-cheat-subclasses/tools-of-the-scoundrel/heads-i-win-tails-you-lose.json`,
			`${FEATURES}/stormshifter/stormshifter-subclasses/circle-of-fang-and-claw/unleash-the-beast.json`,
			`${FEATURES}/shepherd/shepherd-subclasses/luminary-of-malice/deathbringers-touch.json`,
			`${FEATURES}/zephyr/zephyr-subclasses/way-of-pain/bring-the-pain.json`,
			`${FEATURES}/commander/weapon-mastery/slashing.json`,
			'packs/magicItems/core/coreRules/gnatbane-weapon.json',
			'packs/spells/core/ice/shatter.json',
		].flatMap((file) => packRules(file).map((rule) => rule.id));
		expect(new Set(ids).size).toBe(ids.length);
		for (const id of ids) expect(String(id)).toMatch(/^[A-Za-z0-9]{16}$/);
	});
});
