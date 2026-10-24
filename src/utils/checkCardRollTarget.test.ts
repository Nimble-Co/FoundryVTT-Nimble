import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import {
	type CheckCard,
	checkCardRollTarget,
	checkRollOfCard,
	collectCheckRerolls,
	d20FormulaWithRollMode,
} from './checkCardRollTarget.js';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';
import type { RerollingActor, RerollRuleLike } from './rerollEntries.js';
import { prepareReroll } from './rerollOptions.js';

const FREE = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 0,
	heroicReaction: '' as const,
};

const WILL_SAVE = { kind: 'save', key: 'will' } as const;

function d20Term(results: Array<{ result: number; active: boolean }>) {
	return { class: 'Die', faces: 20, number: results.length, modifiers: [], results };
}

function serializedSave(formula = '1d20 + 3[Will]') {
	return {
		class: 'NimbleRoll',
		formula,
		total: 12,
		options: {},
		data: { respondentId: 'Scene.s.Token.t' },
		terms: [d20Term([{ result: 9, active: true }])],
	};
}

function makeCard(overrides: Partial<CheckCard> = {}, serialized = serializedSave()) {
	return {
		roll: WILL_SAVE,
		rollMode: () => 0,
		roller: () => ({ uuid: 'Actor.roller' }),
		rollsSource: () => [JSON.stringify(serialized)],
		update: vi.fn(async (_changes: Record<string, unknown>) => undefined),
		...overrides,
	} satisfies CheckCard;
}

/** Make every evaluated roll keep this d20 result. */
function rollD20(value: number) {
	return vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (
		this: NimbleRoll,
	) {
		const die = (this.terms as unknown as Array<{ faces?: number; results?: unknown[] }>).find(
			(term) => term.faces === 20,
		);
		if (die) die.results = [{ result: value, active: true }];
		return this as never;
	});
}

beforeEach(() => {
	vi.restoreAllMocks();
	(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn(() => null);
});

describe('checkRollOfCard', () => {
	it('reads the roll kind and key of the three check cards', () => {
		expect(checkRollOfCard('savingThrow', { saveKey: 'will' })).toEqual(WILL_SAVE);
		expect(checkRollOfCard('skillCheck', { skillKey: 'lore' })).toEqual({
			kind: 'skillCheck',
			key: 'lore',
		});
		expect(checkRollOfCard('abilityCheck', { abilityKey: 'strength' })).toEqual({
			kind: 'abilityCheck',
			key: 'strength',
		});
	});

	it('gives nothing for another card or a card with no key', () => {
		expect(checkRollOfCard('spell', { saveKey: 'will' })).toBeNull();
		expect(checkRollOfCard('savingThrow', { saveKey: '' })).toBeNull();
	});
});

describe('d20FormulaWithRollMode', () => {
	it('rebuilds the d20 term and keeps the modifiers', () => {
		expect(d20FormulaWithRollMode('1d20 + 3[Will] + 1d4', 1)).toBe('2d20khn + 3[Will] + 1d4');
		expect(d20FormulaWithRollMode('2d20khn + 3[Will]', -1)).toBe('2d20kln + 3[Will]');
		expect(d20FormulaWithRollMode('3d20kln + 2', 0)).toBe('1d20 + 2');
	});

	it('keeps a minimum d20 result', () => {
		expect(d20FormulaWithRollMode('1d20min10 + 2', 1)).toBe('2d20min10khn + 2');
	});

	it('refuses a formula that does not start with a d20', () => {
		expect(() => d20FormulaWithRollMode('1d6 + 2', 1)).toThrow();
	});
});

describe('checkCardRollTarget', () => {
	it('gives the gate the check and the roller, with no targets or outcome', () => {
		const context = checkCardRollTarget(makeCard()).context();

		expect(context).toEqual({
			attacker: { uuid: 'Actor.roller' },
			targets: [],
			roll: WILL_SAVE,
			outcome: null,
			forcedMiss: false,
		});
	});

	it('finds the card roll with its formula, the card roll mode and the kept d20', () => {
		const found = checkCardRollTarget(makeCard({ rollMode: () => 2 })).findRoll();

		expect(found?.replaced).toMatchObject({
			formula: '1d20 + 3[Will]',
			options: { rollMode: 2 },
		});
		expect(found?.previousResult).toBe(9);
	});

	it('finds no roll on a card with none', () => {
		expect(checkCardRollTarget(makeCard({ rollsSource: () => [] })).findRoll()).toBeNull();
	});

	it('makes the new roll with the same class and data, the modifiers and the roll mode change', async () => {
		rollD20(17);
		const found = checkCardRollTarget(makeCard({ rollMode: () => 1 })).findRoll();
		if (!found) throw new Error('no roll');
		const next = prepareReroll(
			found.replaced.formula ?? '',
			found.replaced.options as Record<string, unknown>,
			{ rollModeChange: 1 },
		);

		const roll = (await found.makeRoll(next.formula, next.options)) as NimbleRoll;

		expect(roll).toBeInstanceOf(NimbleRoll);
		expect(roll.formula).toBe('3d20khn + 3[Will]');
		expect(roll.data.respondentId).toBe('Scene.s.Token.t');
		expect(roll.options).toMatchObject({ rollMode: 2, rollModeSources: [1, 1] });
		expect(found.readNewDie?.(roll)).toEqual({ faces: 20, value: 17 });
	});

	it('writes nothing until the flow writes, then puts the new roll first in one update', async () => {
		rollD20(4);
		const card = makeCard();
		const found = checkCardRollTarget(card).findRoll();
		if (!found) throw new Error('no roll');
		const roll = await found.makeRoll('1d20 + 3[Will]', {});
		const entries = [{ id: 'entry-1', kind: 'reroll', used: true } as IncomingReactionEntry];

		const prepared = await found.prepare(roll, entries);
		expect(card.update).not.toHaveBeenCalled();
		expect(prepared.context.roll).toEqual(WILL_SAVE);
		expect(prepared.entries).toBe(entries);

		await prepared.write({ incomingReactions: entries, rerolls: [], discardedCritTriggers: false });

		expect(vi.mocked(card.update)).toHaveBeenCalledTimes(1);
		const changes = vi.mocked(card.update).mock.calls[0][0] as {
			rolls: string[];
			system: Record<string, unknown>;
		};
		expect(JSON.parse(changes.rolls[0]).formula).toBe('1d20 + 3[Will]');
		expect(changes.rolls).toHaveLength(1);
		expect(changes.system).toEqual({ incomingReactions: entries, rerolls: [] });
	});
});

function rerollRule(overrides: Partial<RerollRuleLike> = {}) {
	return {
		type: 'reroll',
		id: 'rule-1',
		label: '',
		item: { name: 'Clear Head', uuid: 'Item.head' },
		automatic: false,
		rerollCost: FREE,
		offersRerollOn: vi.fn(
			(context: { side: string; roll: { kind: string; key?: string } }) =>
				context.side === 'roller' && context.roll.kind === 'save' && context.roll.key === 'will',
		),
		rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
		...overrides,
	} satisfies RerollRuleLike;
}

function postedRoll() {
	const roll = new NimbleRoll('1d20 + 3[Will]', { respondentId: 'Actor.roller' });
	(roll.terms[0] as unknown as { results: unknown[] }).results = [{ result: 6, active: true }];
	return roll;
}

describe('collectCheckRerolls', () => {
	it('stamps the roller entries of a rule that matches the check', async () => {
		const roller: RerollingActor = { uuid: 'Actor.roller', rules: [rerollRule()] };
		const roll = postedRoll();

		const result = await collectCheckRerolls({ roller, roll, check: WILL_SAVE, rollMode: 0 });

		expect(result.roll).toBe(roll);
		expect(result.rerolls).toEqual([]);
		expect(result.incomingReactions).toEqual([
			expect.objectContaining({
				kind: 'reroll',
				side: 'roller',
				actorUuid: 'Actor.roller',
				targetTokenUuid: null,
				itemUuid: 'Item.head',
				used: false,
			}),
		]);
	});

	it('stamps nothing for a check with another key', async () => {
		const roller: RerollingActor = { uuid: 'Actor.roller', rules: [rerollRule()] };

		const result = await collectCheckRerolls({
			roller,
			roll: postedRoll(),
			check: { kind: 'save', key: 'strength' },
			rollMode: 0,
		});

		expect(result.incomingReactions).toEqual([]);
	});

	it('runs an automatic rule before the card is posted', async () => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
		rollD20(15);
		const rule = rerollRule({
			automatic: true,
			rerollChanges: () => ({ rollModeChange: 1, primaryDieBonus: 0, extraDamage: '' }),
		});
		const roller: RerollingActor = { uuid: 'Actor.roller', isOwner: true, rules: [rule] };

		const result = await collectCheckRerolls({
			roller,
			roll: postedRoll(),
			check: WILL_SAVE,
			rollMode: 0,
		});

		expect(result.roll.formula).toBe('2d20khn + 3[Will]');
		expect(result.incomingReactions).toEqual([
			expect.objectContaining({ itemUuid: 'Item.head', used: true }),
		]);
		expect(result.rerolls).toEqual([
			expect.objectContaining({
				faces: 20,
				previous: { value: 6, outcome: null },
				next: { value: 15, outcome: null },
			}),
		]);
	});

	it('stamps nothing when the roller is unknown', async () => {
		const result = await collectCheckRerolls({
			roller: null,
			roll: postedRoll(),
			check: WILL_SAVE,
			rollMode: 0,
		});

		expect(result.incomingReactions).toEqual([]);
	});
});
