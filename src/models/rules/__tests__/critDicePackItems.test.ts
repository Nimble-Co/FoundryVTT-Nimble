import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Predicate } from '../../../etc/Predicate.js';
import { ChangeDieRule } from '../changeDie.js';
import { CritDiceRule } from '../critDice.js';
import { CritDiceSaveRule } from '../critDiceSave.js';

const CHEAT = 'packs/classFeatures/core/the-cheat';
const SNEAK_ATTACK = `${CHEAT}/the-cheat-progression/sneak-attack.json`;
const TWIST_1 = `${CHEAT}/the-cheat-progression/twist-the-blade-1.json`;
const TWIST_2 = `${CHEAT}/the-cheat-progression/twist-the-blade-2.json`;
const CUNNING_STRIKE = `${CHEAT}/the-cheat-subclasses/tools-of-the-silent-blade/cunning-strike.json`;

type RuleData = Record<string, unknown> & { type: string; predicate?: never };

const readRules = (file: string): RuleData[] =>
	JSON.parse(readFileSync(resolve(file), 'utf8')).system.rules;

function liveRule<T>(RuleClass: new (...args: never[]) => T, data: RuleData, level: number): T {
	const actor = {
		uuid: 'Actor.hero',
		level,
		getDomain: () => new Set<string>(),
		getFlag: () => undefined,
		getRollData: () => ({ level }),
		items: [],
		rules: [],
	};
	const parent = {
		isEmbedded: true,
		actor,
		name: 'Pack item',
		uuid: 'Actor.hero.Item.pack',
		getDomain: () => new Set([`level:${level}`]),
	};
	const rule = new RuleClass({ type: data.type } as never, { parent, strict: false } as never);
	Object.assign(rule as object, { ...data, predicate: new Predicate(data.predicate ?? {}) });
	Object.defineProperty(rule, 'item', { get: () => parent, configurable: true });
	return rule;
}

describe('the crit dice of the pack items', () => {
	beforeEach(() => {
		vi.stubGlobal('Roll', { replaceFormulaData: (formula: string) => formula });
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it.each([
		[1, '1d6'],
		[2, '1d6'],
		[3, '1d8'],
		[6, '1d8'],
		[7, '2d8'],
		[9, '2d10'],
		[11, '2d12'],
		[15, '2d20'],
		[17, '3d20'],
		[20, '3d20'],
	])('Sneak Attack at level %i gives %s, and no other rule gives dice', (level, formula) => {
		const specs = readRules(SNEAK_ATTACK).flatMap((data) => {
			const spec = liveRule(CritDiceRule, data, level).specFor('melee');
			return spec ? [spec] : [];
		});

		expect(specs).toHaveLength(1);
		expect(specs[0]).toMatchObject({ formula, role: 'critBonus', oncePerTurn: true });
	});

	it('Twist the Blade (1) costs an action and does not block with no action left', () => {
		const rule = liveRule(ChangeDieRule, readRules(TWIST_1)[0], 5);

		expect(rule.needsCritBonusDice).toBe(true);
		expect(rule.yieldsTo).toBe('twist-the-blade-free');
		expect(rule.rollUseCost).toMatchObject({ actionCost: 1, actionReportOnly: true });
	});

	it('Twist the Blade (2) is free and has a 1/turn limit', () => {
		const rule = liveRule(ChangeDieRule, readRules(TWIST_2)[0], 11);

		expect(rule.identifier).toBe('twist-the-blade-free');
		expect(rule.rollUseCost).toMatchObject({ actionCost: 0 });
		expect(rule.rollUseCost.turnUseKey).toBeTruthy();
	});

	it('Cunning Strike needs a use and one target', () => {
		const rules = readRules(CUNNING_STRIKE);
		expect(rules.find((data) => data.type === 'chargePool')).toMatchObject({
			identifier: 'cunning-strike',
			max: '2',
		});
		const save = rules.find((data) => data.type === 'critDiceSave') as RuleData;
		const rule = liveRule(CritDiceSaveRule, save, 5);

		expect(rule.needsCritBonusDice).toBe(true);
		expect(rule.rollUseCost.chargePoolIdentifier).toBe('cunning-strike');
		expect(
			JSON.parse(readFileSync(resolve(CUNNING_STRIKE), 'utf8')).system.activation.effects,
		).toEqual([]);
	});
});
