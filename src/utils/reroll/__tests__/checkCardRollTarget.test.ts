import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import { NimbleRoll } from '../../../dice/NimbleRoll.js';
import type { IncomingReactionEntry } from '../../incomingReactions/incomingReactionEntry.js';
import {
	type CheckCard,
	checkCardRerollData,
	checkCardRollTarget,
	createCheckCard,
} from '../checkCardRollTarget.js';
import { checkRollOfCard } from '../checkRollOfCard.js';
import type { RerollingActor, RerollRuleLike } from '../rerollEntries.js';
import { prepareReroll } from '../rerollOptions.js';

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
		incomingReactions: () => [],
		resultChanges: () => [],
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

describe('the d20 of a check reroll', () => {
	async function rerollFormula(formula: string, rollMode: number) {
		rollD20(10);
		const found = checkCardRollTarget(makeCard({}, serializedSave(formula))).findRoll();
		if (!found) throw new Error('no roll');
		return found.makeRoll(formula, { rollMode });
	}

	it('is rebuilt for the roll mode, and the modifiers stay', async () => {
		expect((await rerollFormula('1d20 + 3[Will] + 1d4', 1)).formula).toBe(
			'2d20khn + 3[Will] + 1d4',
		);
		expect((await rerollFormula('2d20khn + 3[Will]', -1)).formula).toBe('2d20kln + 3[Will]');
		expect((await rerollFormula('3d20kln + 2', 0)).formula).toBe('1d20 + 2');
	});

	it('keeps a minimum d20 result', async () => {
		expect((await rerollFormula('1d20min10 + 2', 1)).formula).toBe('2d20min10khn + 2');
	});

	it('refuses a formula that does not start with a d20', async () => {
		await expect(rerollFormula('1d6 + 2', 1)).rejects.toThrow();
	});
});

describe('checkCardRollTarget', () => {
	it('gives the gate the check and the roller, with no targets or outcome', () => {
		const context = checkCardRollTarget(makeCard()).context();

		expect(context).toEqual({
			card: {
				total: 12,
				changes: [],
				roller: { uuid: 'Actor.roller' },
				result: null,
				rollModifier: 3,
				naturalOneFails: false,
			},
			attacker: { uuid: 'Actor.roller' },
			targets: [],
			allies: [],
			roll: WILL_SAVE,
			outcome: null,
			forcedMiss: false,
		});
	});

	it("gives the gate the allies the card's entries name, without a new scan", () => {
		const bard = { uuid: 'Actor.bard' };
		(globalThis as unknown as { fromUuidSync: unknown }).fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.bard' ? bard : null,
		);
		const allyEntry = (id: string, extra: Partial<IncomingReactionEntry> = {}) =>
			({
				id,
				kind: 'reroll',
				source: 'rule',
				actorUuid: 'Actor.bard',
				tokenUuid: 'Scene.s.Token.bard',
				targetTokenUuid: null,
				side: 'ally',
				label: '',
				ruleId: 'r',
				itemUuid: 'Item.song',
				used: false,
				...extra,
			}) satisfies IncomingReactionEntry;
		const card = makeCard({
			incomingReactions: () => [
				allyEntry('a'),
				allyEntry('b', { actorUuid: 'Actor.neutral', leftOut: { reason: 'disposition' } }),
			],
		});

		expect(checkCardRollTarget(card).context().allies).toEqual([
			{ tokenUuid: 'Scene.s.Token.bard', actor: bard, isAlly: true, spaces: 0 },
		]);
	});

	it('finds the card roll with its formula, the card roll mode and the kept d20', () => {
		const found = checkCardRollTarget(makeCard({ rollMode: () => 2 })).findRoll();

		expect(found?.replaced).toMatchObject({
			formula: '1d20 + 3[Will]',
			options: { rollMode: 2 },
		});
		expect(found?.previousResult).toBe(9);
	});

	describe('with Change a Result clicks', () => {
		const add = {
			id: 'a',
			lineId: 'a',
			change: 'add',
			value: 3,
			retired: false,
			before: null,
		} as unknown as ResultChange;

		function written(card: ReturnType<typeof makeCard>) {
			return (card.update as unknown as Mock).mock.calls[0]?.[0] as {
				system: Record<string, unknown>;
			};
		}

		async function place(card: ReturnType<typeof makeCard>, use?: 'change') {
			rollD20(17);
			const found = checkCardRollTarget(card).findRoll();
			if (!found) throw new Error('no roll');
			const roll = await found.makeRoll('1d20 + 3[Will]', {});
			const prepared = await found.prepare(roll, []);
			await prepared.write({
				incomingReactions: [],
				rerolls: [{ ...(use ? { use } : {}) } as never],
				rollChanges: [],
				discardedCritTriggers: false,
			});
		}

		it('tells the live gate a save that fails on its natural 1', () => {
			const save = {
				...serializedSave(),
				total: 4,
				terms: [d20Term([{ result: 1, active: true }])],
			};

			expect(checkCardRollTarget(makeCard({}, save)).context().card?.naturalOneFails).toBe(true);
		});

		it('gives the live gate the total with the clicks on it, and the roller', () => {
			const roller = { uuid: 'Actor.roller' };
			const card = makeCard({ roller: () => roller, resultChanges: () => [add, add] });

			expect(checkCardRollTarget(card).context().card).toEqual({
				total: 18,
				changes: [add, add],
				roller,
				result: null,
				rollModifier: 3,
				naturalOneFails: false,
			});
		});

		it('shows the total with the clicks on it as the old result of a keep', () => {
			const found = checkCardRollTarget(makeCard({ resultChanges: () => [add] })).findRoll();

			expect(found?.shownTotal?.()).toBe(15);
		});

		it('retires the clicks when a new roll is placed', async () => {
			const card = makeCard({ resultChanges: () => [add] });

			await place(card);

			expect(written(card).system.resultChanges).toEqual([{ ...add, retired: true, before: 12 }]);
		});

		it('keeps the clicks when a change of a die is placed', async () => {
			const card = makeCard({ resultChanges: () => [add] });

			await place(card, 'change');

			expect(written(card).system).not.toHaveProperty('resultChanges');
		});

		it('writes no clicks on a card with none', async () => {
			const card = makeCard();

			await place(card);

			expect(written(card).system).not.toHaveProperty('resultChanges');
		});
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

		await prepared.write({
			incomingReactions: entries,
			rerolls: [],
			discardedCritTriggers: false,
			rollChanges: [],
		});

		expect(vi.mocked(card.update)).toHaveBeenCalledTimes(1);
		const changes = vi.mocked(card.update).mock.calls[0][0] as {
			rolls: string[];
			system: Record<string, unknown>;
		};
		expect(JSON.parse(changes.rolls[0]).formula).toBe('1d20 + 3[Will]');
		expect(changes.rolls).toHaveLength(1);
		expect(changes.system).toEqual({
			incomingReactions: entries,
			rerolls: [],
			rollChanges: [],
			pendingKeep: null,
			rollMode: 0,
		});
	});

	it('writes the roll mode the new roll used, so the card shows it', async () => {
		rollD20(4);
		const card = makeCard();
		const found = checkCardRollTarget(card).findRoll();
		if (!found) throw new Error('no roll');
		const roll = await found.makeRoll('1d20 + 3[Will]', { rollModeSources: [0, 1] });

		const prepared = await found.prepare(roll, []);
		await prepared.write({
			incomingReactions: [],
			rerolls: [],
			discardedCritTriggers: false,
			rollChanges: [],
		});

		const changes = vi.mocked(card.update).mock.calls[0][0] as { system: Record<string, unknown> };
		expect(changes.system.rollMode).toBe(1);
	});
});

describe('createCheckCard', () => {
	/** A roller whose automatic Will save reroll costs 1 Wound. */
	async function postWithWoundCost() {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
		rollD20(15);
		const roller = {
			uuid: 'Actor.roller',
			isOwner: true,
			system: { attributes: { wounds: { value: 0, max: 6 } } },
			update: vi.fn(async (changes: Record<string, unknown>) => {
				for (const [path, value] of Object.entries(changes)) {
					foundry.utils.setProperty(roller, path, value);
				}
			}),
			rules: [] as RerollRuleLike[],
		};
		roller.rules.push(
			rerollRule({ rerollsByItself: true, actor: roller, rollUseCost: { ...FREE, woundCost: 1 } }),
		);
		const rerolls = await checkCardRerollData(roller, postedRoll(), WILL_SAVE, 0);
		expect(roller.system.attributes.wounds.value).toBe(1);
		return { roller, rerolls };
	}

	function stubCreate(create: () => Promise<unknown>) {
		vi.stubGlobal('ChatMessage', { create: vi.fn(create) });
	}

	it('keeps the cost paid when the card is made', async () => {
		const { roller, rerolls } = await postWithWoundCost();
		const message = { id: 'message-1' };
		stubCreate(async () => message);

		try {
			expect(await createCheckCard({ type: 'savingThrow' }, rerolls)).toBe(message);
			expect(roller.system.attributes.wounds.value).toBe(1);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('gives the cost back when a hook stops the card', async () => {
		const { roller, rerolls } = await postWithWoundCost();
		stubCreate(async () => undefined);

		try {
			expect(await createCheckCard({ type: 'savingThrow' }, rerolls)).toBeNull();
			expect(roller.system.attributes.wounds.value).toBe(0);
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('gives the cost back when the create throws', async () => {
		const { roller, rerolls } = await postWithWoundCost();
		stubCreate(async () => {
			throw new Error('create failed');
		});

		try {
			await expect(createCheckCard({ type: 'savingThrow' }, rerolls)).rejects.toThrow(
				'create failed',
			);
			expect(roller.system.attributes.wounds.value).toBe(0);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

function rerollRule(overrides: Partial<RerollRuleLike> = {}) {
	return {
		type: 'reroll',
		id: 'rule-1',
		label: '',
		item: { name: 'Clear Head', uuid: 'Item.head' },
		rerollsByItself: false,
		rollUseCost: FREE,
		offersUseOn: vi.fn(
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

describe('the rerolls of a posted check', () => {
	it('stamps the roller entries of a rule that matches the check', async () => {
		const roller: RerollingActor = { uuid: 'Actor.roller', rules: [rerollRule()] };
		const roll = postedRoll();

		const result = await checkCardRerollData(roller, roll, WILL_SAVE, 0);

		expect(result.roll).toBe(roll);
		expect(result.system.rerolls).toEqual([]);
		expect(result.system.incomingReactions).toEqual([
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

		const result = await checkCardRerollData(
			roller,
			postedRoll(),
			{ kind: 'save', key: 'strength' },
			0,
		);

		expect(result.system.incomingReactions).toEqual([]);
	});

	it('runs an automatic rule before the card is posted', async () => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
		rollD20(15);
		const rule = rerollRule({
			rerollsByItself: true,
			rerollChanges: () => ({ rollModeChange: 1, primaryDieBonus: 0, extraDamage: '' }),
		});
		const roller: RerollingActor = { uuid: 'Actor.roller', isOwner: true, rules: [rule] };

		const result = await checkCardRerollData(roller, postedRoll(), WILL_SAVE, 0);

		expect(result.roll.formula).toBe('2d20khn + 3[Will]');
		expect(result.system.incomingReactions).toEqual([
			expect.objectContaining({ itemUuid: 'Item.head', used: true }),
		]);
		expect(result.system.rerolls).toEqual([
			expect.objectContaining({
				faces: 20,
				previous: { value: 6, outcome: null },
				next: { value: 15, outcome: null },
			}),
		]);
	});

	it("adds the owner's Modify Reroll changes to an automatic reroll, and marks it automatic", async () => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
		rollD20(15);
		const courage = {
			id: 'courage-rule',
			type: 'modifyReroll',
			rerollIdentifier: 'inspiration',
			rollModeChange: 1,
			item: { name: 'Courage', uuid: 'Item.courage' },
		};
		const rule = rerollRule({
			rerollsByItself: true,
			identifier: 'inspiration',
			actor: {
				getRollData: () => ({}),
				items: { contents: [{ rules: new Map([[courage.id, courage]]) }] },
			} as never,
		});
		const roller: RerollingActor = { uuid: 'Actor.roller', isOwner: true, rules: [rule] };

		const data = await checkCardRerollData(roller, postedRoll(), WILL_SAVE, 0);

		const change = {
			key: 'Item.courage#courage-rule:rollMode',
			kind: 'rollMode',
			label: 'Courage',
			value: 1,
		};
		expect(data.roll.formula).toBe('2d20khn + 3[Will]');
		expect(data.system.rollChanges).toEqual([change]);
		expect(data.system.rerolls).toEqual([
			expect.objectContaining({ automatic: true, changes: [change] }),
		]);
	});

	it("stamps the ally entries of creatures on the roller's scene, and keeps one that is not an ally as left out", async () => {
		const offersUseOn = vi.fn(
			(context: { side: string; roll: { kind: string } }) =>
				context.side === 'ally' && context.roll.kind === 'save',
		);
		const allyActor = (uuid: string) => ({
			uuid,
			rules: [{ ...rerollRule({ offersUseOn }), usedBy: 'ally' }],
		});
		const grid = { isGridless: true, size: 100 };
		const placed = (id: string, actor: unknown, disposition: number) => ({
			id,
			uuid: `Scene.s.Token.${id}`,
			x: 0,
			y: 0,
			hidden: false,
			disposition,
			actor,
		});
		const roller = { uuid: 'Actor.roller', rules: [] as RerollRuleLike[] };
		const rollerToken = placed('roller', roller, 1);
		const scene = {
			grid,
			tokens: [
				rollerToken,
				placed('bard', allyActor('Actor.bard'), 1),
				placed('stranger', allyActor('Actor.stranger'), 0),
			],
		};
		for (const token of scene.tokens) Object.assign(token, { parent: scene });

		const result = await checkCardRerollData(
			{ ...roller, token: rollerToken } as RerollingActor,
			postedRoll(),
			WILL_SAVE,
			0,
		);

		expect(result.system.incomingReactions).toEqual([
			expect.objectContaining({
				side: 'ally',
				actorUuid: 'Actor.bard',
				tokenUuid: 'Scene.s.Token.bard',
				leftOut: null,
			}),
			expect.objectContaining({
				side: 'ally',
				actorUuid: 'Actor.stranger',
				leftOut: { reason: 'disposition' },
			}),
		]);
	});

	it('stamps nothing for a roller with no rules', async () => {
		const result = await checkCardRerollData({ uuid: 'Actor.roller' }, postedRoll(), WILL_SAVE, 0);

		expect(result.system.incomingReactions).toEqual([]);
	});
});

describe('checkCardRerollData', () => {
	it('writes the roller and keeps the roll mode when nothing rerolled', async () => {
		const roller = {
			uuid: 'Actor.roller',
			token: { uuid: 'Scene.s.Token.t' },
			rules: [rerollRule()],
		};

		const data = await checkCardRerollData(roller, postedRoll(), WILL_SAVE, -1);

		expect(data.system).toMatchObject({
			actorUuid: 'Actor.roller',
			tokenUuid: 'Scene.s.Token.t',
			rerolls: [],
			rollMode: -1,
		});
	});

	it('writes the roll mode of the roll that stands after an automatic reroll', async () => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
		rollD20(15);
		const rule = rerollRule({
			rerollsByItself: true,
			rerollChanges: () => ({ rollModeChange: 1, primaryDieBonus: 0, extraDamage: '' }),
		});
		const roller = { uuid: 'Actor.roller', isOwner: true, rules: [rule] };

		const data = await checkCardRerollData(roller, postedRoll(), WILL_SAVE, 0);

		expect(data.roll.formula).toBe('2d20khn + 3[Will]');
		expect(data.system.rollMode).toBe(1);
	});
});

describe('a check card that knows its DC', () => {
	it('gives the gate the result, read again when the card changes', () => {
		const roll = { ...serializedSave(), total: 12 };
		let total = 12;
		const card = makeCard({
			dc: () => 14,
			rollsSource: () => [JSON.stringify({ ...roll, total })],
		});
		expect(checkCardRollTarget(card).context().card?.result).toBe('failed');
		total = 15;
		expect(checkCardRollTarget(card).context().card?.result).toBe('succeeded');
	});

	it('gives no result when there is no DC', () => {
		const context = checkCardRollTarget(makeCard()).context();
		expect(context.card?.result).toBeNull();
	});

	it('gives the modifier of the roll: the total less the kept die', () => {
		const context = checkCardRollTarget(makeCard()).context();
		expect(context.card?.rollModifier).toBe(3);
	});
});

describe('the other stats of a check', () => {
	const rollData = {
		strength: 1,
		dexterity: 2,
		intelligence: 0,
		will: 3,
		strengthSave: 4,
		dexteritySave: -1,
		intelligenceSave: 0,
		willSave: 5,
	};
	const roller = () => ({ uuid: 'Actor.roller', getRollData: () => rollData });

	function save(formula: string) {
		return makeCard({ roller: roller }, serializedSave(formula));
	}

	it('lists the save modifiers of the three other stats on a save', () => {
		const found = checkCardRollTarget(save('1d20 + 5[Will Mod]')).findRoll();
		expect(found?.statChoices?.()).toEqual([
			{ stat: 'strength', mod: 4 },
			{ stat: 'dexterity', mod: -1 },
			{ stat: 'intelligence', mod: 0 },
		]);
	});

	it('moves the save modifier to the new stat and keeps the other bonuses and the roll mode', () => {
		const card = makeCard(
			{ roller: roller, rollMode: () => 1 },
			serializedSave('1d20 + 5[Will Mod] + 2[Bless]'),
		);
		const found = checkCardRollTarget(card).findRoll();
		if (!found?.withStat) throw new Error('No stat swap');
		const swapped = found.withStat(found, 'strength');

		expect(swapped?.replaced.formula).toBe('1d20 + 4[Strength Mod] + 2[Bless]');
		expect(swapped?.replaced.options).toMatchObject({ statUsed: 'strength', rollMode: 1 });
	});

	it('swaps the stat part of a skill and keeps its other bonuses', () => {
		const card = makeCard(
			{ roll: { kind: 'skillCheck', key: 'might' }, roller: roller },
			serializedSave('1d20 + 3[Might Mod] + 2[Bless]'),
		);
		const found = checkCardRollTarget(card).findRoll();
		if (!found?.withStat) throw new Error('No stat swap');
		const choices = found.statChoices?.().map((choice) => choice.stat);
		expect(choices).toEqual(['dexterity', 'intelligence', 'will']);

		// Might is a strength skill worth 3 here: strength 1 becomes dexterity 2, so 1 more.
		const swapped = found.withStat(found, 'dexterity');
		expect(swapped?.replaced.formula).toBe('1d20 + 4[Might Mod] + 2[Bless]');
	});

	it('refuses the stat in use, and one the roller has no value for', () => {
		const found = checkCardRollTarget(save('1d20 + 5[Will Mod]')).findRoll();
		if (!found?.withStat) throw new Error('No stat swap');
		expect(found.withStat(found, 'will')).toBeNull();
		expect(found.withStat(found, 'charisma')).toBeNull();
	});

	it('reads the stat a first swap picked on a second swap', () => {
		const serialized = {
			...serializedSave('1d20 + 4[Strength Mod]'),
			options: { statUsed: 'strength' },
		};
		const card = makeCard({ roller: roller }, serialized);
		const found = checkCardRollTarget(card).findRoll();
		expect(found?.statChoices?.().map((choice) => choice.stat)).toEqual([
			'dexterity',
			'intelligence',
			'will',
		]);
	});

	it('has no stat to pick on Initiative', () => {
		const card = makeCard({ roll: { kind: 'initiative', key: '' } as never, roller: roller });
		expect(checkCardRollTarget(card).findRoll()?.statChoices?.()).toEqual([]);
	});
});

describe('a rule that counts a low roll as a natural 20', () => {
	const naturalRule = (relatedTo = 'will') => ({
		...rerollRule(),
		type: 'changeResult',
		id: 'nat',
		offersUseOn: vi.fn(() => false),
		countsAsNat20On: (roll: { key?: string }) => roll.key === relatedTo,
	});
	const lowRoll = (formula = '1d20 - 2[Will]') => {
		const roll = new NimbleRoll(formula, { respondentId: 'Actor.roller' });
		(roll.terms[0] as unknown as { results: unknown[] }).results = [{ result: 2, active: true }];
		Object.defineProperty(roll, 'total', { value: 0, configurable: true });
		return roll;
	};

	beforeEach(() => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
	});

	it('writes an automatic change when the card is posted, and the dice stay', async () => {
		const rule = naturalRule();
		const roller: RerollingActor = { uuid: 'Actor.roller', isOwner: true, rules: [rule] };

		const result = await checkCardRerollData(roller, lowRoll(), WILL_SAVE, 0);

		expect(result.system.resultChanges).toEqual([
			expect.objectContaining({ change: 'countsAsNat20', value: 18, automatic: true }),
		]);
		expect(result.system.resultChanges?.[0].paid).toEqual({ charges: 0, mana: 0, wounds: 0 });
		expect(result.roll.total).toBe(0);
	});

	it('writes nothing for another stat', async () => {
		const roller: RerollingActor = {
			uuid: 'Actor.roller',
			isOwner: true,
			rules: [naturalRule('strength')],
		};
		const result = await checkCardRerollData(roller, lowRoll(), WILL_SAVE, 0);
		expect(result.system.resultChanges).toBeUndefined();
	});

	it('writes nothing with Feature Effects off', async () => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => false,
		};
		const roller: RerollingActor = { uuid: 'Actor.roller', isOwner: true, rules: [naturalRule()] };
		const result = await checkCardRerollData(roller, lowRoll(), WILL_SAVE, 0);
		expect(result.system.resultChanges).toBeUndefined();
	});

	it('is read again on a new roll and on a change of a die', async () => {
		const rule = naturalRule();
		const roller = { uuid: 'Actor.roller', rules: [rule] };
		const old = {
			id: 'old',
			lineId: 'old',
			change: 'countsAsNat20',
			value: 18,
			automatic: true,
			retired: false,
			paid: { charges: 0, mana: 0, wounds: 0 },
		} as unknown as ResultChange;
		const card = makeCard({
			roller: () => roller,
			resultChanges: () => [old],
		});
		const found = checkCardRollTarget(card).findRoll();
		const prepared = await found?.prepare(lowRoll(), []);
		await prepared?.write({
			incomingReactions: [],
			rerolls: [{ use: 'change' }],
			rollChanges: [],
		} as never);

		const written = (card.update as Mock).mock.calls[0][0].system.resultChanges as ResultChange[];
		expect(written.filter((change) => !change.retired)).toEqual([
			expect.objectContaining({ change: 'countsAsNat20', value: 18, automatic: true }),
		]);
		expect(written.map((change) => change.id)).not.toContain('old');
	});

	it('keeps a success that a reroll made by itself on a change of a die', async () => {
		const succeeded = {
			id: 'sure',
			lineId: 'sure',
			change: 'succeed',
			value: 0,
			automatic: true,
			retired: false,
			paid: { charges: 0, mana: 0, wounds: 0 },
		} as unknown as ResultChange;
		const card = makeCard({
			roller: () => ({ uuid: 'Actor.roller', rules: [] }),
			resultChanges: () => [succeeded],
		});
		const prepared = await checkCardRollTarget(card).findRoll()?.prepare(lowRoll(), []);
		await prepared?.write({
			incomingReactions: [],
			rerolls: [{ use: 'change' }],
			rollChanges: [],
		} as never);

		const { system } = (card.update as Mock).mock.calls[0][0];
		expect(system.resultChanges ?? [succeeded]).toEqual([succeeded]);
	});

	it('shows the counted total as the new result of a keep', () => {
		const card = makeCard({ roller: () => ({ uuid: 'Actor.roller', rules: [naturalRule()] }) });
		const found = checkCardRollTarget(card).findRoll();
		expect(found?.keepChoice?.(lowRoll() as never).total).toBe(18);
	});
});

describe('an automatic reroll for a failed check', () => {
	const failedRule = () =>
		rerollRule({ rerollsByItself: true, outcome: 'failed', id: 'failed-rule' });
	const roller = (rule: RerollRuleLike): RerollingActor => ({
		uuid: 'Actor.roller',
		isOwner: true,
		rules: [rule],
	});

	beforeEach(() => {
		(globalThis as unknown as { game: { settings: unknown } }).game.settings = {
			get: () => true,
		};
	});

	it('runs at posting on a known failure', async () => {
		rollD20(15);
		const result = await checkCardRerollData(roller(failedRule()), postedRoll(), WILL_SAVE, 0, 14);
		expect(result.system.rerolls).toHaveLength(1);
	});

	it('stays a row when the check succeeded', async () => {
		const roll = postedRoll();
		Object.defineProperty(roll, 'total', { value: 9, configurable: true });
		const result = await checkCardRerollData(roller(failedRule()), roll, WILL_SAVE, 0, 5);
		expect(result.system.rerolls).toEqual([]);
		expect(result.system.incomingReactions).toEqual([
			expect.objectContaining({ ruleId: 'failed-rule', used: false }),
		]);
	});

	it('stays a row when no DC gives a result', async () => {
		const result = await checkCardRerollData(roller(failedRule()), postedRoll(), WILL_SAVE, 0);
		expect(result.system.rerolls).toEqual([]);
		expect(result.system.incomingReactions[0]).toMatchObject({ used: false });
	});
});
