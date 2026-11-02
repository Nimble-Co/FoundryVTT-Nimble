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
