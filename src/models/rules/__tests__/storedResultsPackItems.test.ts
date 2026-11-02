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

	describe('Thrill of the Hunt', () => {
		const HUNTER = 'packs/classFeatures/core/hunter';
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
