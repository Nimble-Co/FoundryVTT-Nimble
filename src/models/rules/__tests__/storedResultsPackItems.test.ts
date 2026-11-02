import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRules = (file: string) =>
	JSON.parse(readFileSync(resolve(file), 'utf8')).system.rules as Array<Record<string, unknown>>;

describe('stored result pack items', () => {
	it('Rampage keeps the amount of a hit', () => {
		const rules = readRules('packs/classFeatures/core/berserker/savage-arsenal/rampage.json');
		expect(rules).toHaveLength(1);
		expect(rules[0]).toMatchObject({ type: 'keepAmount', label: 'Rampage' });
	});

	describe('monsters', () => {
		const item = (file: string, name: string) =>
			(
				JSON.parse(readFileSync(resolve(file), 'utf8')).items as Array<{
					name: string;
					system: { rules: Record<string, unknown>[]; activation: { effects: any[] } };
				}>
			).find((each) => each.name === name)?.system;
		const AZRIEL = 'packs/legendaryMonsters/core/azriel-lord-of-pain-and-flame.json';
		const DRAVOK = 'packs/legendaryMonsters/core/dravok-all-seeing-tyrant.json';

		it('PAIN! makes crits Vicious and gives the crit dice back', () => {
			const rules = item(AZRIEL, 'PAIN!')?.rules;
			expect(rules?.[0]).toMatchObject({ side: 'attacksAgainstYou', viciousCrits: true });
			expect(rules?.[1]).toMatchObject({
				type: 'damageBack',
				onlyCrits: true,
				amount: 'critDice',
			});
		});

		it('Last Stand makes every hit against Azriel a crit', () => {
			expect(item(AZRIEL, 'Last Stand')?.rules[0]).toMatchObject({
				side: 'attacksAgainstYou',
				forceCrit: 'onHit',
				predicate: { $and: ['self:lastStand'] },
			});
		});

		it('Terrible Maw has its rule, and no note that it is not modeled', () => {
			const maw = item(DRAVOK, 'Terrible Maw');
			expect(maw?.rules[0]).toMatchObject({
				anyDieCrits: true,
				viciousCrits: true,
				thisItemOnly: true,
			});
			expect(JSON.stringify(maw?.activation)).not.toContain('not modeled');
		});
	});

	describe('Thrill of the Hunt', () => {
		const HUNTER = 'packs/classFeatures/core/hunter';
		const activation = (file: string) =>
			JSON.parse(readFileSync(resolve(`${HUNTER}/${file}.json`), 'utf8')).system.activation;

		it.each([
			['incendiary-shot', 'ranged', true],
			['addling-arrow', 'ranged', true],
			['multishot', 'ranged', true],
			['come-get-some', 'any', true],
			['pinning-shot', 'ranged', true],
			['sharpshooter', 'ranged', true],
			['hail-of-arrows', 'ranged', false],
			['vital-shot', 'ranged', true],
			['heavy-shot', 'ranged', true],
		])('%s attacks with a %s weapon, cannot miss, and spends 1 charge', (name, kind, canCrit) => {
			const file = `thrill-of-the-hunt/${name}`;
			const { weaponAttack, effects } = activation(file);
			expect(weaponAttack).toBe(kind);
			expect(effects[0]).toMatchObject({ type: 'damage', canMiss: false, canCrit });
			expect(readRules(`${HUNTER}/${file}.json`)).toContainEqual(
				expect.objectContaining({
					type: 'chargeConsumer',
					poolIdentifier: 'thrill-of-the-hunt',
					poolScope: 'actor',
					cost: '1',
				}),
			);
		});

		it('Incendiary Shot adds WIL d8 fire damage', () => {
			const { effects } = activation('thrill-of-the-hunt/incendiary-shot');
			expect(effects[1]).toMatchObject({ damageType: 'fire', formula: '(@will)d8' });
		});

		it.each([
			['come-get-some', ['taunted']],
			['pinning-shot', ['restrained']],
			['hail-of-arrows', ['slowed']],
		])('%s gives its condition on a hit', (name, conditions) => {
			const hit = activation(`thrill-of-the-hunt/${name}`).effects[0].on.hit;
			expect(
				hit
					.filter((node: { type: string }) => node.type === 'condition')
					.map((node: { condition: string }) => node.condition),
			).toEqual(conditions);
		});

		it('Hail of Arrows hits an area of 3x3', () => {
			expect(activation('thrill-of-the-hunt/hail-of-arrows')).toMatchObject({
				acquireTargetsFromTemplate: true,
				template: { shape: 'square', width: 3 },
			});
		});

		it('Vital Shot ignores armor', () => {
			const { effects } = activation('thrill-of-the-hunt/vital-shot');
			expect(effects[0].ignoreArmor).toBe(true);
		});

		it.each([
			['snare-trap', ['restrained']],
			['grease-trap', ['prone', 'smoldering']],
		])('%s is 1/encounter and spends 1 charge', (name, conditions) => {
			const file = `${HUNTER}/thrill-of-the-hunt/${name}.json`;
			const consumers = readRules(file).filter((rule) => rule.type === 'chargeConsumer');
			expect(consumers.map((rule) => rule.poolIdentifier)).toEqual([
				`${name}-use`,
				'thrill-of-the-hunt',
			]);
			expect(
				activation(`thrill-of-the-hunt/${name}`).effects.map(
					(node: { condition: string }) => node.condition,
				),
			).toEqual(conditions);
		});

		it('Wild Instinct is a free Assess that spends a charge when there is one', () => {
			expect(readRules(`${HUNTER}/thrill-of-the-hunt/wild-instinct.json`)).toEqual([
				expect.objectContaining({
					type: 'freeAssess',
					chargePoolIdentifier: 'thrill-of-the-hunt',
				}),
			]);
		});

		it('Final Takedown is a melee crit that cannot miss, and the creature can crit back', () => {
			const file = 'hunter-progression/final-takedown';
			expect(activation(file).weaponAttack).toBe('melee');
			expect(activation(file).effects[0]).toMatchObject({ canMiss: false, canCrit: true });
			const rules = readRules(`${HUNTER}/${file}.json`);
			expect(rules.map((rule) => rule.type)).toEqual([
				'attackOutcome',
				'critBack',
				'chargeConsumer',
			]);
			expect(rules[0]).toMatchObject({ forceCrit: 'always', thisItemOnly: true });
		});

		it("Hunter's Mark doubles for Final Takedown, and for Vital Shot with no armor", () => {
			const bonus = readRules(`${HUNTER}/hunter-progression/hunters-mark.json`).find(
				(rule) => rule.type === 'conditionalBonus',
			);
			expect(bonus?.doubleFor).toEqual([
				{ source: 'final-takedown', onlyNoArmor: false },
				{ source: 'vital-shot', onlyNoArmor: true },
			]);
		});

		const pool = () =>
			readRules(`${HUNTER}/hunter-progression/thrill-of-the-hunt.json`).find(
				(rule) => rule.type === 'chargePool',
			) as { recoveries: Array<Record<string, unknown>> } & Record<string, unknown>;

		it('starts at 0 and is lost when combat ends (H:757)', () => {
			expect(pool()).toMatchObject({ initial: 'zero', scope: 'actor', showAsResource: true });
			expect(pool().recoveries.find((each) => each.trigger === 'encounterEnd')).toMatchObject({
				mode: 'set',
				value: '0',
			});
		});

		it('gains when the quarry dies, on a melee hit, and on a ranged crit (H:691, H:693)', () => {
			const gains = pool().recoveries.filter((each) => each.notWhenSpent);
			expect(gains.map((each) => [each.trigger, each.predicate])).toEqual([
				['onMarkedDeath', {}],
				['onHit', { $and: ['target:quarry', 'attack:melee'] }],
				['onCriticalHit', { $and: ['target:quarry', 'attack:ranged'] }],
			]);
		});

		it.each([
			['hunter-progression/veteran-stalker', ['onBloodied', 'onWound']],
			['hunter-progression/wild-endurance', ['onTurnStart']],
			['hunter-subclasses/keeper-of-the-shadowpath/apex-predator', ['onInitiativeRolled']],
		])('%s adds its gains to the pool', (file, triggers) => {
			const [rule] = readRules(`${HUNTER}/${file}.json`) as Array<{
				poolIdentifier: string;
				addRefills: Array<{ trigger: string; mode: string; needsFeatureEffects: boolean }>;
			}>;
			expect(rule.poolIdentifier).toBe('thrill-of-the-hunt');
			expect(rule.addRefills.map((each) => each.trigger)).toEqual(triggers);
			for (const entry of rule.addRefills) expect(entry.needsFeatureEffects).toBe(true);
		});
	});

	describe('Invoker of Control', () => {
		const INVOKER = 'packs/classFeatures/core/mage/mage-subclasses/invoker-of-control';
		const controlRule = (file: string) =>
			readRules(`${INVOKER}/${file}.json`).find((rule) => rule.type === 'demandControl');

		it('Force of Will opens the window, and reports 1/round', () => {
			expect(controlRule('force-of-will')).toMatchObject({ opensOnUse: true, oncePerRound: true });
		});

		it('Deny Fate is a row', () => {
			expect(controlRule('deny-fate')).toMatchObject({ cardRow: true, opensOnUse: false });
		});

		it('Nullify ignores disadvantage and opens the window, 1/encounter', () => {
			expect(controlRule('nullify')).toMatchObject({
				opensOnUse: true,
				ignoresDisadvantage: true,
			});
			const rules = readRules(`${INVOKER}/nullify.json`);
			expect(rules.find((rule) => rule.type === 'chargePool')).toMatchObject({ max: '1' });
			expect(rules.find((rule) => rule.type === 'chargeConsumer')).toMatchObject({ cost: '1' });
		});

		it('Supreme Control triggers twice', () => {
			expect(controlRule('supreme-control')).toMatchObject({ triggerTwice: true });
		});
	});
});
