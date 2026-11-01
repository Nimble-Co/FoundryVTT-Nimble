import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleRoll } from '../../dice/NimbleRoll.js';
import type {
	IncomingReactionEntry,
	ResultChange,
} from '../../utils/incomingReactions/incomingReactionEntry.js';
import { stopRerollRolling } from '../../utils/reroll/rerollRolling.svelte.js';
import { checkResultOfCard } from '../../utils/rolls/checkResult.js';
import { resultTotal } from '../../utils/rolls/resultChanges.js';
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
function createCard(entries: IncomingReactionEntry[], dc: number | null = 14): Card {
	const roll = {
		class: 'NimbleRoll',
		formula: '1d20 + 2[Will]',
		total: 7,
		options: {},
		data: {},
		terms: [{ class: 'Die', faces: 20, number: 1, results: [{ result: 5, active: true }] }],
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
	card.resolveRerollReaction(lastEntry(card, rule).id, 'gm-user');

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
		expect(card.canStillUseReroll(lastEntry(card, 'soul'))).toBe(true);

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

		await card.resolveResultRemoval(lineId, 'gm-user');

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

		await card.resolveResultRemoval(lineId, 'gm-user');

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

		await card.resolveResultRemoval(lineId, 'gm-user');

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

		await card.resolveResultRemoval(card.system.resultChanges[0].lineId, 'gm-user');

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

		await card.resolveResultRemoval(card.system.resultChanges[2].lineId, 'gm-user');

		expect(card.system.resultChanges.map((change) => change.change)).toEqual(['setTotal', 'add']);
		expect(card.system.resultChanges[0].id).toBe(firstSet.id);
		expect(shownTotal(card)).toBe(13);
	});

	it('records only what Remove gives back: no action and no heroic reaction', async () => {
		const { card } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);

		expect(Object.keys(card.system.resultChanges[0].paid)).toEqual(['charges', 'mana', 'wounds']);
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

		await card.resolveResultRemoval(card.system.resultChanges[0].lineId, 'gm-user');

		expect(card.system.incomingReactions.filter((e) => !e.used)).toHaveLength(1);
	});

	it('lets the owner of the actor remove over the socket, not another player', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);

		await card.resolveResultRemoval(lineId, 'stranger', true);
		expect(card.system.resultChanges).toHaveLength(1);

		await card.resolveResultRemoval(lineId, 'owner', true);
		expect(card.system.resultChanges).toEqual([]);
	});

	it('does not believe a socket request that claims a GM', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);

		await card.resolveResultRemoval(lineId, 'gm-user', true);

		expect(card.system.resultChanges).toHaveLength(1);
	});

	it('runs only on a GM client', async () => {
		const { card, lineId } = await cardWith({ change: 'succeed', value: 0, stat: '' }, FREE);
		globals().game.user = { isGM: false, id: 'owner' };

		await card.resolveResultRemoval(lineId, 'owner');

		expect(card.system.resultChanges).toHaveLength(1);
	});

	it('gives a cost back one time when the line is removed two times', async () => {
		const { card, roller, lineId } = await cardWith(
			{ change: 'succeed', value: 0, stat: '' },
			{ ...FREE, manaCost: 2 },
		);

		await card.resolveResultRemoval(lineId, 'gm-user');
		await card.resolveResultRemoval(lineId, 'gm-user');

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

		await card.resolveResultRemoval(lineId, 'gm-user');

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
