import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import {
	type CardSurge,
	canRerollSurgeDie,
	endSurgeMana,
	regainSurgeManaOnCard,
	rerollSurgeDieOnCard,
	rollSurge,
	surgeTotal,
} from '../surgeMana.js';

let automation = true;

function diceRolls(...faces: number[]) {
	const queue = [...faces];
	vi.spyOn(foundry.dice, 'Roll').mockImplementation(((formula: string) => {
		const [, count, size] = /^(\d+)d(\d+)/.exec(formula) ?? [];
		const results = Array.from({ length: Number(count) }, () => ({ result: queue.shift() ?? 2 }));
		return {
			dice: [{ faces: Number(size), results }],
			evaluate: async () => {},
		};
	}) as never);
}

function mage(mana: number, rules: unknown[], flag?: unknown) {
	const actor = {
		rules,
		system: { resources: { mana: { current: mana } } },
		getFlag: () => flag,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const next = changes['system.resources.mana.current'];
			if (typeof next === 'number') actor.system.resources.mana.current = next;
		}),
	};
	return actor;
}

const surgeRule = (flat: number, dice: string) => ({
	type: 'surgeMana',
	surgeSpec: { feature: 'Elemental Surge', flat, dice },
});
const steelWill = { type: 'surgeRerollOnes', rerollFeature: 'Steel Will' };

describe('a surge at Initiative', () => {
	beforeEach(() => {
		automation = true;
		vi.stubGlobal('game', {
			settings: {
				get: (_scope: string, key: string) => automation || key !== 'automation.applyRuleEffects',
			},
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
	});

	it('gives WIL mana with no dice, above the max too', async () => {
		const actor = mage(10, [surgeRule(3, '')]);

		const surge = await rollSurge(actor, 'combat');

		expect(surge).toMatchObject({ flat: 3, dice: [], manaGiven: true });
		expect(actor.system.resources.mana.current).toBe(13);
	});

	it('adds the dice at level 10', async () => {
		diceRolls(3);
		const actor = mage(2, [surgeRule(3, '1d4')]);

		const surge = (await rollSurge(actor, 'combat')) as CardSurge;

		expect(surgeTotal(surge)).toBe(6);
		expect(actor.system.resources.mana.current).toBe(8);
	});

	it('gives nothing with no combat', async () => {
		expect(await rollSurge(mage(0, [surgeRule(3, '')]), null)).toBeNull();
	});

	it('gives nothing again in the same combat', async () => {
		const actor = mage(0, [surgeRule(3, '')], { combatId: 'combat', before: 0 });
		expect(await rollSurge(actor, 'combat')).toBeNull();
		expect(actor.update).not.toHaveBeenCalled();
	});

	it('with Steel Will, each 1 rolls again by itself one time, also to a new 1', async () => {
		diceRolls(1, 4, 1);
		const actor = mage(0, [surgeRule(0, '2d4'), steelWill]);

		const surge = (await rollSurge(actor, 'combat')) as CardSurge;

		expect(surge.dice).toEqual([
			{ faces: 4, value: 1, was: 1 },
			{ faces: 4, value: 4 },
		]);
		expect(surgeTotal(surge)).toBe(5);
	});

	it('with no Steel Will, a 1 stays', async () => {
		diceRolls(1);
		const surge = (await rollSurge(mage(0, [surgeRule(0, '1d4')]), 'combat')) as CardSurge;

		expect(surge.dice).toEqual([{ faces: 4, value: 1 }]);
	});

	describe('with Feature Effects off', () => {
		beforeEach(() => {
			automation = false;
		});

		it('shows the dice and gives no mana', async () => {
			diceRolls(1);
			const actor = mage(0, [surgeRule(2, '1d4'), steelWill]);

			const surge = (await rollSurge(actor, 'combat')) as CardSurge;

			expect(surge.manaGiven).toBe(false);
			expect(canRerollSurgeDie(surge, surge.dice[0])).toBe(true);
			expect(actor.update).not.toHaveBeenCalled();
		});

		it('a row rolls a 1 again, one time', async () => {
			diceRolls(3);
			const surge: CardSurge = {
				feature: 'Elemental Surge',
				flat: 2,
				dice: [{ faces: 4, value: 1 }],
				rerollFeature: 'Steel Will',
				manaGiven: false,
				combatId: 'combat',
			};
			const card = { system: { surge }, update: vi.fn(async () => {}) };

			await rerollSurgeDieOnCard(card, 0);

			expect(card.update).toHaveBeenCalledWith({
				'system.surge.dice': [{ faces: 4, value: 3, was: 1 }],
			});
		});

		it('the button gives the mana one time', async () => {
			const surge: CardSurge = {
				feature: 'Elemental Surge',
				flat: 2,
				dice: [{ faces: 4, value: 3 }],
				rerollFeature: '',
				manaGiven: false,
				combatId: 'combat',
			};
			const card = { system: { surge }, update: vi.fn(async () => {}) };
			const actor = mage(1, []);

			await regainSurgeManaOnCard(card, actor);

			expect(actor.system.resources.mana.current).toBe(6);
			expect(card.update).toHaveBeenCalledWith({ 'system.surge.manaGiven': true });
		});
	});

	describe('at the end of combat', () => {
		const flag = { combatId: 'combat', before: 2 };

		it('takes away what the surge left', async () => {
			const actor = mage(5, [], flag);
			await endSurgeMana(actor, 'combat');
			expect(actor.system.resources.mana.current).toBe(2);
			expect(actor.update).toHaveBeenCalledWith(
				expect.objectContaining({ [`flags.${SYSTEM_ID}.-=surgeMana`]: null }),
			);
		});

		it('takes no mana when the hero spent the surge', async () => {
			const actor = mage(1, [], flag);
			await endSurgeMana(actor, 'combat');
			expect(actor.system.resources.mana.current).toBe(1);
		});

		it('does nothing for another combat', async () => {
			const actor = mage(5, [], flag);
			await endSurgeMana(actor, 'other');
			expect(actor.update).not.toHaveBeenCalled();
		});
	});
});

describe('the pack items of the surge', () => {
	const rules = (file: string) =>
		JSON.parse(readFileSync(resolve('packs/classFeatures/core/mage', file), 'utf8')).system.rules;

	it('Elemental Surge has the numbers of the book', () => {
		expect(rules('mage-progression/elemental-surge.json')).toMatchObject([
			{ flat: '@will', dice: '', predicate: { level: { max: 9 } } },
			{ flat: '@will', dice: '1d4', predicate: { level: { min: 10, max: 16 } } },
			{ flat: '@will', dice: '2d4', predicate: { level: { min: 17 } } },
		]);
	});

	it('Steel Will rerolls a 1 with no use spent', () => {
		const steel = rules('mage-subclasses/invoker-of-control/steel-will.json');
		expect(steel.at(-1)).toMatchObject({ type: 'surgeRerollOnes' });
	});
});
