import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { RULE_CLASSES } from '../../../config/ruleClasses.js';
import { Predicate } from '../../../etc/Predicate.js';
import { validateItemChargeConsumption } from '../../../utils/chargePool/chargePoolConsume.js';
import { ChargePoolRuleConfig } from '../../../utils/chargePool/chargePoolRuleConfig.js';
import { buildEffectiveChargePoolMap } from '../../../utils/chargePool/helpers.js';
import type { CharacterActorLike } from '../../../utils/chargePool/types.js';

type Json = Record<string, any>;

const DIR = 'packs/classFeatures/core/hunter/hunter-subclasses/beastmaster';

function readItem(file: string): Json {
	return JSON.parse(readFileSync(resolve(`${DIR}/${file}`), 'utf8'));
}

function rulesOfType(item: Json, type: string): Json[] {
	return (item.system.rules as Json[]).filter((rule) => rule.type === type);
}

function expectKnownFields(rule: Json): void {
	const ruleClass = RULE_CLASSES[rule.type as keyof typeof RULE_CLASSES];
	expect(ruleClass, rule.type).toBeDefined();
	const schema = ruleClass.defineSchema() as Record<string, unknown>;
	expect(Object.keys(rule).filter((key) => !(key in schema))).toEqual([]);
}

function leveled(item: Json, level: number): Json[] {
	const domain = new Set([`level:${level}`]);
	return (item.system.rules as Json[]).map((rule) => ({
		...rule,
		appliesTo: () => new Predicate(rule.predicate ?? {}).test(domain),
	}));
}

function ruleMap(rules: Json[]): Map<string, Json> {
	return new Map(rules.map((rule, index) => [String(index), rule]));
}

const THRILL = {
	id: 'thrill-of-the-hunt',
	name: 'Thrill of the Hunt',
	rules: ruleMap([
		{
			type: 'chargePool',
			id: 'thrillOfTheHuntP',
			identifier: 'thrill-of-the-hunt',
			label: 'Thrill of the Hunt',
			scope: 'actor',
			max: '99',
			initial: 'max',
			appliesTo: () => true,
		},
	]),
	flags: {},
};

function featureItem(pack: Json, level: number, emptyPools: string[] = []): Json {
	const flags = emptyPools.length
		? {
				[ChargePoolRuleConfig.flagScope]: {
					[ChargePoolRuleConfig.flagKey]: Object.fromEntries(
						emptyPools.map((identifier) => [identifier, { current: 0, max: 1, seeded: true }]),
					),
				},
			}
		: {};
	return {
		id: pack._id,
		name: pack.name,
		uuid: `Item.${pack._id}`,
		rules: ruleMap(leveled(pack, level)),
		flags,
	};
}

function actorWith(feature: Json): CharacterActorLike {
	const items = [feature, THRILL];
	const actor = {
		type: 'character',
		system: { levelUpHistory: [] },
		items: { contents: items, get: (id: string) => items.find((item) => item.id === id) },
		flags: {},
		getRollData: () => ({ level: 1 }),
	} as unknown as CharacterActorLike;
	feature.actor = actor;
	return actor;
}

function poolMax(pack: Json, level: number, identifier: string): number | undefined {
	const feature = featureItem(pack, level);
	const actor = actorWith(feature);
	return Object.values(buildEffectiveChargePoolMap(actor)).find(
		(pool) => pool.identifier === identifier && pool.sourceItemId === pack._id,
	)?.max;
}

function use(pack: Json, level: number, emptyPools: string[] = []) {
	const feature = featureItem(pack, level, emptyPools);
	actorWith(feature);
	return validateItemChargeConsumption(feature as unknown as Item);
}

const keenEyes = readItem('small-keen-eyes.json');
const smallThroat = readItem('small-go-for-the-throat.json');
const mediumThroat = readItem('medium-go-for-the-throat.json');

describe('Small Keen Eyes', () => {
	it('marks a quarry and spends no action', () => {
		for (const rule of keenEyes.system.rules) expectKnownFields(rule);
		const [mark, ...more] = rulesOfType(keenEyes, 'markTarget');
		expect(more).toEqual([]);
		expect(mark).toMatchObject({ flagKey: 'quarry', statusCondition: 'marked', maxTargets: 1 });
		expect(keenEyes.system.activation.cost).toMatchObject({ type: 'none', quantity: 1 });
	});

	it('is 1 use an encounter, 2 from level 7, and 3 from level 11', () => {
		const [pool] = rulesOfType(keenEyes, 'chargePool');
		expect(pool).toMatchObject({
			identifier: 'small-keen-eyes',
			max: '1',
			scope: 'item',
			recoveries: [{ trigger: 'encounterEnd', mode: 'refresh', value: '1' }],
		});
		expect(poolMax(keenEyes, 1, 'small-keen-eyes')).toBe(1);
		expect(poolMax(keenEyes, 6, 'small-keen-eyes')).toBe(1);
		expect(poolMax(keenEyes, 7, 'small-keen-eyes')).toBe(2);
		expect(poolMax(keenEyes, 10, 'small-keen-eyes')).toBe(2);
		expect(poolMax(keenEyes, 11, 'small-keen-eyes')).toBe(3);
	});

	it('refuses a second use once the encounter pool is empty', () => {
		expect(use(keenEyes, 1).ok).toBe(true);
		const refused = use(keenEyes, 1, ['small-keen-eyes']);
		expect(refused.ok).toBe(false);
		expect(refused.failure).toMatchObject({
			code: 'insufficientCharges',
			poolIdentifier: 'small-keen-eyes',
			available: 0,
		});
	});
});

describe('Small Go for the Throat!', () => {
	it('attacks for 1d4+@level, ignoring armor, and cannot miss, for no action', () => {
		for (const rule of smallThroat.system.rules) expectKnownFields(rule);
		expect(smallThroat.system.activation.cost).toMatchObject({ type: 'none', quantity: 1 });
		expect(smallThroat.system.activation.effects).toEqual([
			expect.objectContaining({
				type: 'damage',
				formula: '1d4+@level',
				ignoreArmor: true,
				canMiss: false,
			}),
		]);
		expect(rulesOfType(smallThroat, 'chargeConsumer')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					poolIdentifier: 'thrill-of-the-hunt',
					poolScope: 'actor',
					cost: '1',
				}),
			]),
		);
	});

	it('is 1 an encounter until level 11, then 2 and 1 a round, then 3 at level 15', () => {
		expect(poolMax(smallThroat, 1, 'small-go-for-the-throat')).toBe(1);
		expect(poolMax(smallThroat, 10, 'small-go-for-the-throat')).toBe(1);
		expect(poolMax(smallThroat, 1, 'small-go-for-the-throat-round')).toBeUndefined();
		expect(poolMax(smallThroat, 11, 'small-go-for-the-throat')).toBe(2);
		expect(poolMax(smallThroat, 11, 'small-go-for-the-throat-round')).toBe(1);
		expect(poolMax(smallThroat, 14, 'small-go-for-the-throat')).toBe(2);
		expect(poolMax(smallThroat, 15, 'small-go-for-the-throat')).toBe(3);
		expect(poolMax(smallThroat, 15, 'small-go-for-the-throat-round')).toBe(1);

		const round = rulesOfType(smallThroat, 'chargePool').find(
			(rule) => rule.identifier === 'small-go-for-the-throat-round',
		);
		expect(round?.recoveries).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ trigger: 'onTurnStart', mode: 'refresh' }),
			]),
		);
	});

	it('refuses a second use in the encounter, and a second use in the round from level 11', () => {
		expect(use(smallThroat, 1).ok).toBe(true);
		expect(use(smallThroat, 1, ['small-go-for-the-throat']).failure).toMatchObject({
			code: 'insufficientCharges',
			poolIdentifier: 'small-go-for-the-throat',
		});
		expect(use(smallThroat, 11).ok).toBe(true);
		expect(use(smallThroat, 11, ['small-go-for-the-throat-round']).failure).toMatchObject({
			code: 'insufficientCharges',
			poolIdentifier: 'small-go-for-the-throat-round',
		});
	});
});

describe('Medium Go for the Throat!', () => {
	it('spends 1 action and 1 Thrill of the Hunt charge to attack for 1d8+(3*@level), ignoring armor', () => {
		for (const rule of mediumThroat.system.rules) expectKnownFields(rule);
		expect(mediumThroat.system.activation.cost).toMatchObject({ type: 'action', quantity: 1 });
		expect(mediumThroat.system.activation.effects).toEqual([
			expect.objectContaining({
				type: 'damage',
				formula: '1d8+(3*@level)',
				ignoreArmor: true,
				canMiss: false,
			}),
		]);
		expect(rulesOfType(mediumThroat, 'chargeConsumer')).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					poolIdentifier: 'thrill-of-the-hunt',
					poolScope: 'actor',
					cost: '1',
				}),
			]),
		);
	});

	it('is 1 an encounter until level 11, then 2, and a second use is refused on an empty pool', () => {
		expect(poolMax(mediumThroat, 3, 'medium-go-for-the-throat')).toBe(1);
		expect(poolMax(mediumThroat, 10, 'medium-go-for-the-throat')).toBe(1);
		expect(poolMax(mediumThroat, 11, 'medium-go-for-the-throat')).toBe(2);
		expect(use(mediumThroat, 3).ok).toBe(true);
		expect(use(mediumThroat, 3, ['medium-go-for-the-throat']).failure).toMatchObject({
			code: 'insufficientCharges',
			poolIdentifier: 'medium-go-for-the-throat',
			available: 0,
		});
	});
});
