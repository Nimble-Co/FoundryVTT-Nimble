import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ResultChange } from '#types/resultChange.d.ts';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import type { IncomingReactionEntry } from '../../utils/incomingReactions/incomingReactionEntry.js';
import { stopRerollRolling } from '../../utils/reroll/rerollRolling.svelte.js';
import { checkResultOfCard } from '../../utils/rolls/checkResult.js';
import { resultTotal } from '../../utils/rolls/resultChanges.js';
import { resultChangeLines } from '../../view/chat/components/resultChangeLines.js';
import { NimbleChatMessage } from '../chatMessage.js';

const ROLLER = 'Actor.roller';
const FREE = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 0,
	heroicReaction: '',
};

type Globals = {
	game: {
		user: { isGM: boolean; id: string };
		users: { get: ReturnType<typeof vi.fn> };
	};
	ui: { notifications: { warn: ReturnType<typeof vi.fn> } };
};

function globals(): Globals {
	return globalThis as unknown as Globals;
}

function makeRoller() {
	const actor = {
		uuid: ROLLER,
		type: 'character',
		name: 'Brom',
		isOwner: true,
		rules: [] as unknown[],
		system: {
			attributes: { wounds: { value: 0, max: 2 } },
			resources: { mana: { current: 5, max: 5 } },
		},
		items: [] as unknown[],
		getRollData: () => ({ strength: 3 }),
		testUserPermission: vi.fn((user: { id: string }) => user.id === 'owner'),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

/** Give the roller a real charge pool with the identifier `elusive`, and return its stored state. */
function withChargePool(roller: ReturnType<typeof makeRoller>, current: number) {
	const pool = { current, max: 1 };
	const item = {
		id: 'item-pool',
		name: 'Elusive',
		flags: { nimble: { chargePools: { elusive: pool } } },
		rules: new Map([
			[
				'pool-rule',
				{
					type: 'chargePool',
					disabled: false,
					id: 'elusive',
					identifier: 'elusive',
					scope: 'item',
					max: '1',
					initial: 'max',
					recoveries: [],
				},
			],
		]),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			const pools = changes['flags.nimble.chargePools'] as Record<string, { current: number }>;
			pool.current = pools.elusive.current;
		}),
	};
	Object.assign(roller, {
		items: { contents: [item], get: () => item },
		getFlag: () => undefined,
		setFlag: vi.fn(),
	});
	return pool;
}

/** A rule with a live gate that reads the card as the real rule does. */
function makeRule(
	roller: ReturnType<typeof makeRoller>,
	id: string,
	use: { change: string; value: number; stat: string },
	rollUseCost: Record<string, unknown> = FREE,
) {
	return {
		type: 'changeResult',
		id,
		change: use.change,
		disabled: false,
		label: '',
		item: { name: id, uuid: `Item.${id}` },
		actor: roller,
		rollUseCost,
		resultUseFor: vi.fn(() => use),
		offersUseOn: vi.fn(() => {
			const wounds = roller.system.attributes.wounds;
			return wounds.value + Number(rollUseCost.woundCost ?? 0) <= wounds.max;
		}),
	};
}

function setupWorld(
	rules: Array<ReturnType<typeof makeRule>>,
	roller: ReturnType<typeof makeRoller>,
) {
	roller.rules = rules;
	const byUuid: Record<string, unknown> = { [ROLLER]: roller };
	for (const rule of rules) {
		byUuid[rule.item.uuid] = { rules: new Map([[rule.id, rule]]) };
	}
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => byUuid[uuid] ?? null),
	);
}

function entryFor(id: string): IncomingReactionEntry {
	return {
		id: `entry-${id}`,
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: id,
		ruleId: id,
		itemUuid: `Item.${id}`,
		used: false,
		outcomeTrigger: 'always',
		use: 'result',
	};
}

type CardSystem = {
	incomingReactions: IncomingReactionEntry[];
	resultChanges: ResultChange[];
	rerolls: unknown[];
	dc?: number | null;
};

type Card = NimbleChatMessage & {
	update: ReturnType<typeof vi.fn>;
	system: CardSystem;
};

/** A save card whose `update` writes to the card, as the document does. */
function createCard(entries: IncomingReactionEntry[], dc: number | null = 14, d20 = 5): Card {
	const roll = {
		class: 'NimbleRoll',
		formula: '1d20 + 2[Will]',
		total: d20 + 2,
		options: {},
		data: {},
		terms: [{ class: 'Die', faces: 20, number: 1, results: [{ result: d20, active: true }] }],
	};
	const message = new NimbleChatMessage({
		type: 'savingThrow',
		system: {
			saveKey: 'will',
			rollMode: 0,
			actorUuid: ROLLER,
			dc,
			incomingReactions: entries,
			resultChanges: [],
			rerolls: [],
		},
	} as unknown as ChatMessage.CreateData) as Card;
	const source = { rolls: [JSON.stringify(roll)] };
	(message as unknown as { _source: typeof source })._source = source;
	(message as { id: string }).id = foundry.utils.randomID();
	Object.assign(message, { system: { ...message.system } });
	const write = async (changes: { rolls?: string[]; system?: Record<string, unknown> }) => {
		Object.assign(message.system, changes.system ?? {});
		if (changes.rolls) source.rolls = changes.rolls;
	};
	message.update = vi.fn(write) as never;
	return message;
}

function lastEntry(card: Card, rule: string): IncomingReactionEntry {
	const entry = card.system.incomingReactions.filter((e) => e.ruleId === rule && !e.used).at(-1);
	if (!entry) throw new Error(`No waiting entry for ${rule}`);
	return entry;
}

const click = (card: Card, rule: string) =>
	card.cardRerolls.resolveRerollReaction(lastEntry(card, rule).id, 'gm-user');

const shownTotal = (card: Card) => resultTotal(7, card.system.resultChanges);

function result(card: Card) {
	return checkResultOfCard('savingThrow', card.system as never, {
		total: 7,
		terms: [{ faces: 20, results: [{ result: 5, active: true }] }],
	});
}

beforeEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	globals().game.user = { isGM: true, id: 'gm-user' };
	globals().game.users = {
		get: vi.fn((id: string) => {
			if (id === 'gm-user') return { isGM: true, id };
			if (id === 'owner' || id === 'stranger') return { isGM: false, id };
			return null;
		}),
	};
	globals().ui.notifications.warn = vi.fn();
});

const TARGET_TOKEN = 'Scene.s.Token.a';

/** A hit card whose `update` writes to the card, as the document does. */
function createAttackCard(entries: IncomingReactionEntry[]): Card {
	const roll = {
		class: 'DamageRoll',
		formula: '1d6 + 2',
		originalFormula: '1d6 + 2',
		total: 8,
		isCritical: false,
		isMiss: false,
		options: { canCrit: true, canMiss: true, rollMode: 0, primaryDieModifier: 1 },
		data: {},
	};
	const message = new NimbleChatMessage({
		type: 'spell',
		system: {
			actorUuid: 'Actor.attacker',
			targets: [TARGET_TOKEN],
			isCritical: false,
			isMiss: false,
			activation: {
				effects: [{ id: 'damage', type: 'damage', parentNode: null, parentContext: null, roll }],
				targets: { count: 1, attackType: 'reach', distance: 1 },
			},
			incomingReactions: entries,
			resultChanges: [],
			rerolls: [],
		},
	} as unknown as ChatMessage.CreateData) as Card;
	(message as unknown as { _source: { rolls: string[] } })._source = {
		rolls: [JSON.stringify(roll)],
	};
	(message as { id: string }).id = foundry.utils.randomID();
	Object.assign(message, { system: { ...message.system } });
	message.update = vi.fn(
		async (changes: { system?: Record<string, unknown> } & Record<string, unknown>) => {
			Object.assign(message.system, changes.system ?? {});
			if ('system.damageApplied' in changes) {
				Object.assign(message.system, { damageApplied: changes['system.damageApplied'] });
			}
		},
	) as never;
	return message;
}

describe('No Damage on an attack card', () => {
	const noDamageUse = { change: 'noDamage', value: 0, stat: '' };

	function world() {
		const roller = makeRoller();
		const pool = withChargePool(roller, 1);
		const rule = makeRule(roller, 'res', noDamageUse, {
			...FREE,
			chargePoolIdentifier: 'elusive',
		});
		setupWorld([rule], roller);
		const inner = fromUuidSync as unknown as (uuid: string) => unknown;
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === TARGET_TOKEN ? { actor: roller } : inner(uuid))),
		);
		const card = createAttackCard([
			{
				...entryFor('res'),
				side: 'target',
				targetTokenUuid: TARGET_TOKEN,
				outcomeTrigger: 'hit',
			},
		]);
		return { pool, card };
	}

	it('writes a change for the target and pays the cost, and the roll stays', async () => {
		const { pool, card } = world();

		await click(card, 'res');

		expect(card.system.resultChanges).toEqual([
			expect.objectContaining({
				change: 'noDamage',
				targetTokenUuid: TARGET_TOKEN,
				retired: false,
			}),
		]);
		expect(pool.current).toBe(0);
		expect(card.update.mock.calls[0][0].rolls).toBeUndefined();
	});

	it('gives the cost back on Remove before the damage is applied', async () => {
		const { pool, card } = world();
		await click(card, 'res');
		const { lineId } = card.system.resultChanges[0];

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(card.system.resultChanges).toEqual([]);
		expect(pool.current).toBe(1);
	});

	it('refuses Remove after the damage is applied, and the cost stays paid', async () => {
		const { pool, card } = world();
		await click(card, 'res');
		const { lineId } = card.system.resultChanges[0];
		Object.assign(card.system, { damageApplied: true });

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(card.system.resultChanges).toHaveLength(1);
		expect(pool.current).toBe(0);
	});
});

describe('a change made by itself', () => {
	it('has no Remove, also from a GM', async () => {
		const roller = makeRoller();
		setupWorld([], roller);
		const card = createCard([]);
		const change = {
			id: 'nat',
			lineId: 'nat',
			entryId: '',
			itemUuid: 'Item.nat',
			ruleId: 'nat',
			label: 'Bumblewise',
			actorUuid: ROLLER,
			change: 'countsAsNat20',
			value: 19,
			stat: '',
			retired: false,
			before: null,
			chargePoolIdentifier: '',
			paid: { charges: 0, mana: 0, wounds: 0 },
			automatic: true,
		} as ResultChange;
		card.system.resultChanges = [change];

		await card.cardRerolls.resolveResultRemoval('nat', 'gm-user');

		expect(card.system.resultChanges).toEqual([change]);
		expect(globals().ui.notifications.warn).toHaveBeenCalled();
	});
});

describe('a rule for a failed roll, on both paths of the gate', () => {
	function world() {
		const roller = makeRoller();
		const rule = {
			...makeRule(roller, 'second', { change: 'succeed', value: 0, stat: '' }),
			type: 'reroll',
			die: 'wholeRoll',
			keep: 'new',
			rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
			offersUseOn: vi.fn(
				(gate: { card?: { result?: string | null } }) => gate.card?.result !== 'succeeded',
			),
		};
		setupWorld([rule as never], roller);
		const { use: _use, ...entry } = entryFor('second');
		const stamped = entry as IncomingReactionEntry;
		const card = createCard([stamped]);
		const evaluate = vi.spyOn(NimbleRoll.prototype, 'evaluate');
		return { card, stamped, evaluate };
	}

	const succeeded = {
		id: 'won',
		lineId: 'won',
		entryId: '',
		itemUuid: 'Item.other',
		ruleId: 'other',
		label: 'Other',
		actorUuid: ROLLER,
		change: 'succeed',
		value: 0,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
	} as ResultChange;

	it('shows on the client on a failure, goes away on a success, and comes back', () => {
		const { card, stamped } = world();
		expect(card.cardRerolls.canStillUseReroll(stamped)).toBe(true);
		card.system.resultChanges = [succeeded];
		expect(card.cardRerolls.canStillUseReroll(stamped)).toBe(false);
		card.system.resultChanges = [];
		expect(card.cardRerolls.canStillUseReroll(stamped)).toBe(true);
	});

	it('is refused by the GM on a success, and the entry stays', async () => {
		const { card, stamped, evaluate } = world();
		card.system.resultChanges = [succeeded];

		await card.cardRerolls.resolveRerollReaction(stamped.id, 'gm-user');

		expect(evaluate).not.toHaveBeenCalled();
		expect(card.system.rerolls).toEqual([]);
		expect(card.system.incomingReactions[0]).toMatchObject({ used: false });
		expect(globals().ui.notifications.warn).toHaveBeenCalled();
	});
});

describe('Modify Reroll: cannot fail, on a save card', () => {
	function world(cannotFail: boolean) {
		const roller = makeRoller();
		const modifier = {
			id: 'song-rule',
			type: 'modifyReroll',
			disabled: false,
			rerollIdentifier: 'inspiration',
			cannotFail,
			rollModeChange: 0,
			extraDamage: '',
			actionsForRoller: 0,
			tempHp: '',
			tempHpWithin: 0,
			appliesTo: () => true,
			item: { name: 'Sure Song', uuid: 'Item.song' },
		};
		Object.assign(roller, { items: { contents: [{ rules: new Map([[modifier.id, modifier]]) }] } });
		const base = makeRule(roller, 'insp', { change: 'succeed', value: 0, stat: '' });
		const rule = {
			...base,
			type: 'reroll',
			identifier: 'inspiration',
			die: 'wholeRoll',
			keep: 'chooser',
			keepChooser: 'roller',
			rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
		};
		setupWorld([rule as never], roller);
		const { use: _use, ...entry } = entryFor('insp');
		vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (
			this: NimbleRoll,
		) {
			const die = (this.terms as unknown as Array<{ faces?: number; results?: unknown[] }>).find(
				(term) => term.faces === 20,
			);
			if (die) die.results = [{ result: 2, active: true }];
			return this as never;
		});
		return createCard([entry as IncomingReactionEntry]);
	}

	it('makes the save succeed, named by the modifier, with nothing paid and no Keep', async () => {
		const card = world(true);

		await click(card, 'insp');

		expect(card.system.resultChanges).toEqual([
			expect.objectContaining({
				change: 'succeed',
				label: 'Sure Song',
				itemUuid: 'Item.song',
				paid: { charges: 0, mana: 0, wounds: 0 },
				automatic: true,
			}),
		]);
		expect(card.system.pendingKeep ?? null).toBeNull();
		expect(card.system.rerolls).toHaveLength(1);
		expect(card.update.mock.calls[0][0].rolls).toBeDefined();
	});

	it('has no Remove: a request to remove the line is refused', async () => {
		const card = world(true);
		await click(card, 'insp');
		const [line] = card.system.resultChanges;

		await card.cardRerolls.resolveResultRemoval(line.lineId, 'gm-user');

		expect(card.system.resultChanges).toHaveLength(1);
	});

	it('changes nothing about the result with no such modifier', async () => {
		const card = world(false);

		await click(card, 'insp');

		expect(card.system.resultChanges).toEqual([]);
	});
});

describe('a reroll limited to one use, on a save card', () => {
	function world(oncePerRoll: boolean) {
		const roller = makeRoller();
		const base = makeRule(roller, 'tumble', { change: 'succeed', value: 0, stat: '' });
		const rule = {
			...base,
			type: 'reroll',
			die: 'wholeRoll',
			keep: 'new',
			oncePerRoll,
			rerollChanges: () => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' }),
		};
		setupWorld([rule as never], roller);
		const { use: _use, ...entry } = entryFor('tumble');
		vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (
			this: NimbleRoll,
		) {
			const die = (this.terms as unknown as Array<{ faces?: number; results?: unknown[] }>).find(
				(term) => term.faces === 20,
			);
			if (die) die.results = [{ result: 2, active: true }];
			return this as never;
		});
		return createCard([entry as IncomingReactionEntry]);
	}

	const waiting = (card: Card) => card.system.incomingReactions.filter((entry) => !entry.used);

	it('gives no new row after its one use', async () => {
		const card = world(true);

		await click(card, 'tumble');

		expect(card.system.rerolls).toHaveLength(1);
		expect(waiting(card)).toEqual([]);
	});

	it('gives a new row with no limit', async () => {
		const card = world(false);

		await click(card, 'tumble');

		expect(waiting(card)).toHaveLength(1);
	});
});

describe('Change a Result on a save card', () => {
	it('adds a succeed: the total stays, the card says Succeeded, a new entry waits', async () => {
		const roller = makeRoller();
		const rule = makeRule(roller, 'elusive', { change: 'succeed', value: 0, stat: '' });
		setupWorld([rule], roller);
		const card = createCard([entryFor('elusive')]);
		expect(result(card)).toBe('failed');

		await click(card, 'elusive');

		expect(card.system.resultChanges).toEqual([
			expect.objectContaining({ change: 'succeed', ruleId: 'elusive', retired: false }),
		]);
		expect(shownTotal(card)).toBe(7);
		expect(result(card)).toBe('succeeded');
		expect(card.system.incomingReactions[0]).toMatchObject({ id: 'entry-elusive', used: true });
		expect(lastEntry(card, 'elusive').use).toBe('result');
		expect(card.update.mock.calls[0][0].rolls).toBeUndefined();
	});

	it('sets the total, and the DC is read again', async () => {
		const roller = makeRoller();
		const rule = makeRule(roller, 'cheat', { change: 'setTotal', value: 14, stat: '' });
		setupWorld([rule], roller);
		const card = createCard([entryFor('cheat')]);

		await click(card, 'cheat');

		expect(shownTotal(card)).toBe(14);
		expect(result(card)).toBe('succeeded');
	});

	it('grows one line for a repeated add and pays each click', async () => {
		const roller = makeRoller();
		const cost = { ...FREE, woundCost: 1 };
		const rule = makeRule(roller, 'soul', { change: 'add', value: 3, stat: 'strength' }, cost);
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);

		await click(card, 'soul');
		await click(card, 'soul');

		const [first, second] = card.system.resultChanges;
		expect(second.lineId).toBe(first.id);
		expect(second.paid.wounds).toBe(1);
		expect(shownTotal(card)).toBe(13);
		expect(result(card)).toBe('failed');
		expect(roller.system.attributes.wounds.value).toBe(2);
	});

	it('works at the last Wound, and gives no new entry when no Wound is left', async () => {
		const roller = makeRoller();
		roller.system.attributes.wounds.value = 1;
		const cost = { ...FREE, woundCost: 1 };
		const rule = makeRule(roller, 'soul', { change: 'add', value: 3, stat: 'strength' }, cost);
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);

		await click(card, 'soul');

		expect(roller.system.attributes.wounds.value).toBe(2);
		expect(card.system.resultChanges).toHaveLength(1);
		expect(card.system.incomingReactions.filter((e) => !e.used)).toEqual([]);
	});

	it('refuses a use the live rule no longer offers, and charges nothing', async () => {
		const roller = makeRoller();
		const rule = makeRule(
			roller,
			'soul',
			{ change: 'add', value: 3, stat: '' },
			{
				...FREE,
				woundCost: 1,
			},
		);
		rule.offersUseOn.mockReturnValue(false);
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);

		await click(card, 'soul');

		expect(card.update).not.toHaveBeenCalled();
		expect(roller.system.attributes.wounds.value).toBe(0);
	});

	it('gives the live gate the card as it stands', async () => {
		const roller = makeRoller();
		const rule = makeRule(roller, 'soul', { change: 'add', value: 3, stat: '' });
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);

		await click(card, 'soul');
		rule.offersUseOn.mockClear();
		expect(card.cardRerolls.canStillUseReroll(lastEntry(card, 'soul'))).toBe(true);

		expect(rule.offersUseOn).toHaveBeenCalledWith(
			expect.objectContaining({ card: expect.objectContaining({ total: 10, roller }) }),
		);
	});

	it('gives the cost back when the click cannot be written', async () => {
		const roller = makeRoller();
		const rule = makeRule(
			roller,
			'soul',
			{ change: 'add', value: 3, stat: '' },
			{
				...FREE,
				woundCost: 1,
			},
		);
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);
		card.update.mockRejectedValueOnce(new Error('lost'));
		vi.spyOn(console, 'error').mockImplementation(() => {});

		await click(card, 'soul');

		expect(roller.system.attributes.wounds.value).toBe(0);
		expect(card.system.resultChanges).toEqual([]);
	});
});

describe('Remove on a Change a Result line', () => {
	async function cardWith(
		change: { change: string; value: number; stat: string },
		cost: Record<string, unknown>,
		clicks = 1,
	) {
		const roller = makeRoller();
		const rule = makeRule(roller, 'feature', change, cost);
		setupWorld([rule], roller);
		const card = createCard([entryFor('feature')]);
		for (let i = 0; i < clicks; i += 1) await click(card, 'feature');
		const lineId = card.system.resultChanges[0].lineId;
		return { card, roller, rule, lineId };
	}

	it('takes a succeed off, gives its Mana back and reads the result again', async () => {
		const { card, roller, lineId } = await cardWith(
			{ change: 'succeed', value: 0, stat: '' },
			{ ...FREE, manaCost: 2 },
		);
		expect(roller.system.resources.mana.current).toBe(3);
		expect(result(card)).toBe('succeeded');

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(card.system.resultChanges).toEqual([]);
		expect(roller.system.resources.mana.current).toBe(5);
		expect(result(card)).toBe('failed');
	});

	it('takes a set total off and works the total out again', async () => {
		const { card, roller, lineId } = await cardWith(
			{ change: 'setTotal', value: 14, stat: '' },
			{ ...FREE, woundCost: 1 },
		);
		expect(result(card)).toBe('succeeded');

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(shownTotal(card)).toBe(7);
		expect(roller.system.attributes.wounds.value).toBe(0);
		expect(result(card)).toBe('failed');
	});

	it('takes all clicks of a grown add off and gives back all Wounds', async () => {
		const { card, roller, lineId } = await cardWith(
			{ change: 'add', value: 4, stat: 'strength' },
			{ ...FREE, woundCost: 1 },
			2,
		);
		expect(roller.system.attributes.wounds.value).toBe(2);
		expect(result(card)).toBe('succeeded');

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(card.system.resultChanges).toEqual([]);
		expect(roller.system.attributes.wounds.value).toBe(0);
		expect(shownTotal(card)).toBe(7);
		expect(result(card)).toBe('failed');
	});

	it('gives uses back to the pool they came from', async () => {
		const roller = makeRoller();
		const pool = withChargePool(roller, 1);
		const rule = makeRule(
			roller,
			'elusive',
			{ change: 'succeed', value: 0, stat: '' },
			{
				...FREE,
				chargePoolIdentifier: 'elusive',
			},
		);
		setupWorld([rule], roller);
		const card = createCard([entryFor('elusive')]);

		await click(card, 'elusive');
		expect(pool.current).toBe(0);
		expect(card.system.resultChanges[0].paid.charges).toBe(1);

		await card.cardRerolls.resolveResultRemoval(card.system.resultChanges[0].lineId, 'gm-user');

		expect(pool.current).toBe(1);
		expect(result(card)).toBe('failed');
	});

	it('keeps the order of the other changes', async () => {
		const roller = makeRoller();
		const add = makeRule(roller, 'add', { change: 'add', value: 3, stat: '' });
		const set = makeRule(roller, 'set', { change: 'setTotal', value: 10, stat: '' });
		setupWorld([add, set], roller);
		const card = createCard([entryFor('add'), entryFor('set')]);
		await click(card, 'set');
		await click(card, 'add');
		await click(card, 'set');
		expect(shownTotal(card)).toBe(10);
		const firstSet = card.system.resultChanges[0];

		await card.cardRerolls.resolveResultRemoval(card.system.resultChanges[2].lineId, 'gm-user');

		expect(card.system.resultChanges.map((change) => change.change)).toEqual(['setTotal', 'add']);
		expect(card.system.resultChanges[0].id).toBe(firstSet.id);
		expect(shownTotal(card)).toBe(13);
	});

	describe('an action or a Heroic Reaction it cost', () => {
		const succeed = { change: 'succeed', value: 0, stat: '' };
		const ACTION_KEPT = 'Remove does not give back actions after the turn ends';
		const REACTION_KEPT = 'Remove does not give back the Heroic Reaction after the turn ends';

		/** A started combat on the roller's turn. Its combatant writes its own updates. */
		function heroCombat(roller: ReturnType<typeof makeRoller>) {
			const hero = {
				id: 'hero',
				type: 'character',
				actor: roller,
				system: {
					actions: {
						base: { current: 3, max: 3 },
						pendingDelta: 0,
						heroic: { defendAvailable: true },
					},
				},
				update: vi.fn(async (changes: Record<string, unknown>) => {
					for (const [path, value] of Object.entries(changes)) {
						foundry.utils.setProperty(hero, path, value);
					}
				}),
			};
			const combat = {
				id: 'combat-1',
				started: true,
				round: 1,
				turn: 0,
				combatant: hero,
				combatants: {
					find: (predicate: (c: unknown) => boolean) => [hero].find(predicate),
					get: (id: string) => (id === hero.id ? hero : undefined),
				},
				useHeroicReactions: vi.fn(async () => {
					hero.system.actions.base.current -= 1;
					hero.system.actions.heroic.defendAvailable = false;
					return true;
				}),
				updateEmbeddedDocuments: vi.fn(
					async (_type: string, [update]: Array<Record<string, unknown>>) => {
						const { _id, ...changes } = update;
						await hero.update(changes);
					},
				),
			};
			(globals().game as { combat?: unknown }).combat = combat;
			return { hero, combat };
		}

		async function paidCard(
			cost: Record<string, unknown>,
			arrange: (combat: ReturnType<typeof heroCombat>['combat']) => void = () => {},
		) {
			const roller = makeRoller();
			const { hero, combat } = heroCombat(roller);
			arrange(combat);
			const rule = makeRule(roller, 'feature', succeed, cost);
			setupWorld([rule], roller);
			const card = createCard([entryFor('feature')]);
			await click(card, 'feature');
			const lineId = card.system.resultChanges[0].lineId;
			return { card, roller, hero, combat, lineId };
		}

		const notes = (card: Card) =>
			resultChangeLines({
				changes: card.system.resultChanges,
				rollTotal: 7,
				speakerUuid: ROLLER,
				documentName: () => '',
				canRemove: () => true,
			}).map((line) => line.note);

		afterEach(() => {
			(globals().game as { combat?: unknown }).combat = null;
		});

		it('records the combat, the round and the combatant whose turn it is', async () => {
			const { card } = await paidCard({ ...FREE, actionCost: 1 });

			expect(card.system.resultChanges[0].paid).toMatchObject({
				action: { combatId: 'combat-1', combatantId: 'hero', amount: 1, now: true },
				stamp: { combatId: 'combat-1', round: 1, combatantId: 'hero' },
			});
		});

		const solo = { id: 'solo', type: 'soloMonster' };
		const ally = { id: 'ally', type: 'character' };

		/** The solo monster's first turn of the round: it acts after each hero. */
		function onSoloTurn(combat: ReturnType<typeof heroCombat>['combat']) {
			Object.assign(combat, { turns: [combat.combatant, solo, ally, solo], turn: 1 });
			Object.assign(combat, { combatant: solo });
		}

		it('gives back the action when a re-sort moved the turn index, and the turn is the same', async () => {
			const { card, hero, combat, lineId } = await paidCard({ ...FREE, actionCost: 1 });
			Object.assign(combat, { turns: [solo, ally, hero, solo] });
			combat.turn = 2;
			expect(notes(card)).toEqual([null]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.base.current).toBe(3);
		});

		it("keeps the action spent in another combatant's turn of the same round", async () => {
			const { card, hero, combat, lineId } = await paidCard({ ...FREE, actionCost: 1 });
			Object.assign(combat, { combatant: { id: 'goblin' } });
			hero.update.mockClear();
			expect(notes(card)).toEqual([ACTION_KEPT]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.base.current).toBe(2);
			expect(hero.update).not.toHaveBeenCalled();
		});

		it('reads the turn before the Remove moves the turn to another combatant', async () => {
			const { card, hero, combat, lineId } = await paidCard({ ...FREE, actionCost: 1 });
			const write = card.update.getMockImplementation() as (changes: unknown) => Promise<void>;
			card.update.mockImplementation(async (changes: unknown) => {
				await write(changes);
				Object.assign(combat, { combatant: { id: 'goblin' } });
			});

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.base.current).toBe(3);
		});

		it("keeps the Heroic Reaction spent in a solo monster's earlier turn of the same round", async () => {
			const { card, hero, combat, lineId } = await paidCard(
				{ ...FREE, heroicReaction: 'defend' },
				onSoloTurn,
			);
			combat.turn = 3;
			expect(notes(card)).toEqual([REACTION_KEPT]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.heroic.defendAvailable).toBe(false);
		});

		it('gives back the Heroic Reaction in the same turn of a solo monster', async () => {
			const { card, hero, lineId } = await paidCard(
				{ ...FREE, heroicReaction: 'defend' },
				onSoloTurn,
			);
			expect(notes(card)).toEqual([null]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.heroic.defendAvailable).toBe(true);
		});

		it('gives back the action in the same turn, on top of an action spent after it', async () => {
			const { card, hero, lineId } = await paidCard({ ...FREE, actionCost: 1 });
			expect(hero.system.actions.base.current).toBe(2);
			hero.system.actions.base.current = 1;
			expect(notes(card)).toEqual([null]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(card.system.resultChanges).toEqual([]);
			expect(hero.system.actions.base.current).toBe(2);
		});

		it('gives back the Heroic Reaction and its action in the same turn, as a change', async () => {
			const { card, hero, lineId } = await paidCard({ ...FREE, heroicReaction: 'defend' });
			expect(hero.system.actions.base.current).toBe(2);
			hero.system.actions.base.current = 1;

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.heroic.defendAvailable).toBe(true);
			expect(hero.system.actions.base.current).toBe(2);
		});

		it('keeps the action spent in a new round, gives the Mana back, and the line says so', async () => {
			const { card, roller, hero, combat, lineId } = await paidCard({
				...FREE,
				actionCost: 1,
				manaCost: 2,
			});
			Object.assign(combat, { round: 2 });
			hero.update.mockClear();
			expect(notes(card)).toEqual([ACTION_KEPT]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(card.system.resultChanges).toEqual([]);
			expect(roller.system.resources.mana.current).toBe(5);
			expect(hero.system.actions.base.current).toBe(2);
			expect(hero.update).not.toHaveBeenCalled();
		});

		it('keeps the Heroic Reaction spent in a new round, and the line says so', async () => {
			const { card, hero, combat, lineId } = await paidCard({ ...FREE, heroicReaction: 'defend' });
			combat.round = 2;
			expect(notes(card)).toEqual([REACTION_KEPT]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(hero.system.actions.heroic.defendAvailable).toBe(false);
			expect(combat.updateEmbeddedDocuments).not.toHaveBeenCalled();
		});

		it('gives back no action for a record with no stamp, and the line says so', async () => {
			const { card, hero, lineId } = await paidCard({ ...FREE, actionCost: 1 });
			const [change] = card.system.resultChanges;
			const { stamp: _stamp, ...paid } = change.paid;
			card.system.resultChanges = [{ ...change, paid }];
			expect(notes(card)).toEqual([ACTION_KEPT]);

			await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

			expect(card.system.resultChanges).toEqual([]);
			expect(hero.system.actions.base.current).toBe(2);
		});
	});

	it('brings the entry back for a rule that could not pay before', async () => {
		const roller = makeRoller();
		roller.system.attributes.wounds.value = 1;
		const rule = makeRule(
			roller,
			'soul',
			{ change: 'add', value: 3, stat: '' },
			{
				...FREE,
				woundCost: 1,
			},
		);
		setupWorld([rule], roller);
		const card = createCard([entryFor('soul')]);
		await click(card, 'soul');
		expect(card.system.incomingReactions.filter((e) => !e.used)).toEqual([]);

		await card.cardRerolls.resolveResultRemoval(card.system.resultChanges[0].lineId, 'gm-user');

		expect(card.system.incomingReactions.filter((e) => !e.used)).toHaveLength(1);
	});

	it('lets the owner of the actor remove over the socket, not another player', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);

		await card.cardRerolls.resolveResultRemoval(lineId, 'stranger', true);
		expect(card.system.resultChanges).toHaveLength(1);

		await card.cardRerolls.resolveResultRemoval(lineId, 'owner', true);
		expect(card.system.resultChanges).toEqual([]);
	});

	it('does not believe a socket request that claims a GM', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user', true);

		expect(card.system.resultChanges).toHaveLength(1);
	});

	it('runs only on a GM client', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);
		globals().game.user = { isGM: false, id: 'owner' };

		await card.cardRerolls.resolveResultRemoval(lineId, 'owner');

		expect(card.system.resultChanges).toHaveLength(1);
	});

	it('gives a cost back one time when the line is removed two times', async () => {
		const { card, roller, lineId } = await cardWith(
			{ change: 'succeed', value: 0, stat: '' },
			{ ...FREE, manaCost: 2 },
		);

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');
		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(roller.system.resources.mana.current).toBe(5);
	});
});

describe('a reroll on a card with changes', () => {
	function rerollRule(roller: ReturnType<typeof makeRoller>) {
		return {
			type: 'reroll',
			id: 'lucky',
			disabled: false,
			label: '',
			item: { name: 'Lucky', uuid: 'Item.lucky' },
			actor: roller,
			rollUseCost: FREE,
			offersUseOn: vi.fn(() => true),
			rerollChanges: vi.fn(() => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' })),
		};
	}

	function setup() {
		const roller = makeRoller();
		const soul = makeRule(
			roller,
			'soul',
			{ change: 'add', value: 3, stat: 'strength' },
			{
				...FREE,
				woundCost: 1,
			},
		);
		const lucky = rerollRule(roller);
		setupWorld([soul, lucky as never], roller);
		const card = createCard([entryFor('soul'), { ...entryFor('lucky'), use: undefined }]);
		vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (
			this: NimbleRoll,
		) {
			const die = (this.terms as unknown as Array<{ faces?: number; results?: unknown[] }>)[0];
			die.results = [{ result: 16, active: true }];
			return this as never;
		});
		return { card, roller };
	}

	it('retires the changes, keeps their lines, and the Wounds stay', async () => {
		const { card, roller } = setup();
		await click(card, 'soul');
		await click(card, 'soul');

		await click(card, 'lucky');
		stopRerollRolling(card.id ?? '', false);

		expect(card.system.resultChanges).toHaveLength(2);
		expect(card.system.resultChanges.every((change) => change.retired)).toBe(true);
		expect(card.system.resultChanges[0].before).toBe(7);
		expect(card.system.resultChanges[1].before).toBe(10);
		expect(roller.system.attributes.wounds.value).toBe(2);
	});

	it('does not let Remove take a retired line off or give its cost back', async () => {
		const { card, roller } = setup();
		await click(card, 'soul');
		const lineId = card.system.resultChanges[0].lineId;
		await click(card, 'lucky');

		await card.cardRerolls.resolveResultRemoval(lineId, 'gm-user');

		expect(card.system.resultChanges).toHaveLength(1);
		expect(roller.system.attributes.wounds.value).toBe(1);
	});

	it('starts a new line for an add after the reroll', async () => {
		const { card } = setup();
		await click(card, 'soul');
		await click(card, 'lucky');

		await click(card, 'soul');

		const [old, fresh] = card.system.resultChanges;
		expect(old.retired).toBe(true);
		expect(fresh.retired).toBe(false);
		expect(fresh.lineId).not.toBe(old.lineId);
	});
});

describe('an add on a roll that fails on its natural 1', () => {
	const WOUND = { ...FREE, woundCost: 1 };
	const addUse = { change: 'add', value: 3, stat: 'strength' };

	function world(d20: number) {
		const roller = makeRoller();
		const soul = makeRule(roller, 'soul', addUse, WOUND);
		const lucky = {
			type: 'reroll',
			id: 'lucky',
			disabled: false,
			label: '',
			item: { name: 'Lucky', uuid: 'Item.lucky' },
			actor: roller,
			rollUseCost: FREE,
			offersUseOn: vi.fn(() => true),
			rerollChanges: vi.fn(() => ({ rollModeChange: 0, primaryDieBonus: 0, extraDamage: '' })),
		};
		setupWorld([soul, lucky as never], roller);
		const card = createCard([entryFor('soul'), { ...entryFor('lucky'), use: undefined }], 14, d20);
		return { card, roller };
	}

	const naturalTwenty = {
		id: 'nat',
		lineId: 'nat',
		entryId: '',
		itemUuid: 'Item.nat',
		ruleId: 'nat',
		label: 'Bumblewise',
		actorUuid: ROLLER,
		change: 'countsAsNat20',
		value: 21,
		stat: '',
		retired: false,
		before: null,
		chargePoolIdentifier: '',
		paid: { charges: 0, mana: 0, wounds: 0 },
		automatic: true,
	} as ResultChange;

	it('keeps the row on a natural 1 save, not usable, and the GM refuses it with no Wound paid', async () => {
		const { card, roller } = world(1);
		const soul = lastEntry(card, 'soul');

		expect(card.cardRerolls.canStillUseReroll(soul)).toBe(false);
		expect(card.cardRerolls.blockedReroll(soul)).toBe('naturalOne');

		await click(card, 'soul');

		expect(card.update).not.toHaveBeenCalled();
		expect(card.system.resultChanges).toEqual([]);
		expect(roller.system.attributes.wounds.value).toBe(0);
	});

	it('is usable on a failed save with a 5', () => {
		const { card } = world(5);
		const soul = lastEntry(card, 'soul');

		expect(card.cardRerolls.canStillUseReroll(soul)).toBe(true);
		expect(card.cardRerolls.blockedReroll(soul)).toBeNull();
	});

	it('is usable again when the 1 counts as a natural 20', () => {
		const { card } = world(1);
		card.system.resultChanges = [naturalTwenty];

		expect(card.cardRerolls.canStillUseReroll(lastEntry(card, 'soul'))).toBe(true);
	});

	it('is usable again after a reroll replaced the 1', async () => {
		const { card } = world(1);
		vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (
			this: NimbleRoll,
		) {
			const die = (this.terms as unknown as Array<{ results?: unknown[] }>)[0];
			die.results = [{ result: 6, active: true }];
			return this as never;
		});

		await click(card, 'lucky');
		stopRerollRolling(card.id ?? '', false);

		expect(card.cardRerolls.canStillUseReroll(lastEntry(card, 'soul'))).toBe(true);
	});

	it('leaves a reroll row on a natural 1 usable', () => {
		const { card } = world(1);
		const lucky = lastEntry(card, 'lucky');

		expect(card.cardRerolls.canStillUseReroll(lucky)).toBe(true);
		expect(card.cardRerolls.blockedReroll(lucky)).toBeNull();
	});
});
