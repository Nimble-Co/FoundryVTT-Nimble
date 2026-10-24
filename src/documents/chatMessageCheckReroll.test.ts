import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleRoll } from '../dice/NimbleRoll.js';
import localize from '../utils/localize.js';
import { NimbleChatMessage } from './chatMessage.js';

/** Reroll rule entries on save, skill check and ability check cards. */

const COST = {
	chargePoolIdentifier: '',
	chargeCost: 1,
	manaCost: 0,
	woundCost: 1,
	heroicReaction: '' as const,
};

const ROLLER = 'Actor.roller';
const ROLLER_TOKEN = 'Scene.s.Token.t';

type Globals = {
	fromUuidSync: ReturnType<typeof vi.fn>;
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
		system: { attributes: { wounds: { value: 0, max: 6 } } },
		testUserPermission: vi.fn(() => true),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(actor, path, value);
			}
		}),
	};
	return actor;
}

function setupWorld() {
	const roller = makeRoller();
	const rule = {
		type: 'reroll',
		id: 'reroll-1',
		disabled: false,
		label: '',
		item: { name: 'Clear Head', uuid: 'Item.head' },
		actor: roller,
		rerollCost: COST,
		offersRerollOn: vi.fn(
			(context: { side: string; roll: { kind: string; key?: string } }) =>
				context.side === 'roller' && context.roll.kind === 'save',
		),
		rerollChanges: vi.fn(() => ({ rollModeChange: 1, primaryDieBonus: 0, extraDamage: '' })),
	};
	roller.rules = [rule];
	const byUuid: Record<string, unknown> = {
		[ROLLER]: roller,
		[ROLLER_TOKEN]: { actor: roller },
		'Item.head': { rules: new Map([[rule.id, rule]]) },
	};
	globals().fromUuidSync = vi.fn((uuid: string) => byUuid[uuid] ?? null);
	return { roller, rule };
}

function entry(overrides: Record<string, unknown> = {}) {
	return {
		id: 'entry-1',
		kind: 'reroll',
		source: 'rule',
		actorUuid: ROLLER,
		tokenUuid: null,
		targetTokenUuid: null,
		side: 'roller',
		label: 'Clear Head',
		ruleId: 'reroll-1',
		itemUuid: 'Item.head',
		used: false,
		outcomeTrigger: 'always',
		...overrides,
	};
}

type MockedMessage = NimbleChatMessage & { update: ReturnType<typeof vi.fn> };

function createSaveCard(system: Record<string, unknown> = {}): MockedMessage {
	const roll = {
		class: 'NimbleRoll',
		formula: '1d20 + 3[Will]',
		total: 11,
		options: {},
		data: { respondentId: ROLLER_TOKEN },
		terms: [{ class: 'Die', faces: 20, number: 1, results: [{ result: 8, active: true }] }],
	};
	const message = new NimbleChatMessage({
		type: 'savingThrow',
		system: {
			saveKey: 'will',
			rollMode: 0,
			actorUuid: ROLLER,
			tokenUuid: ROLLER_TOKEN,
			incomingReactions: [entry()],
			rerolls: [],
			...system,
		},
	} as unknown as ChatMessage.CreateData) as MockedMessage;
	message.update = vi.fn().mockResolvedValue(undefined);
	(message as unknown as { _source: { rolls: string[] } })._source = {
		rolls: [JSON.stringify(roll)],
	};
	return message;
}

function payload(message: MockedMessage) {
	return message.update.mock.calls[0]?.[0] as {
		rolls: string[];
		system: {
			incomingReactions: Array<Record<string, unknown>>;
			rerolls: Array<Record<string, unknown>>;
		};
	};
}

beforeEach(() => {
	vi.restoreAllMocks();
	globals().game.user = { isGM: true, id: 'gm-user' };
	globals().game.users = {
		get: vi.fn((id: string) => {
			if (id === 'gm-user') return { isGM: true, id };
			if (id === 'player-1') return { isGM: false, id };
			return null;
		}),
	};
	globals().ui.notifications.warn = vi.fn();
	vi.spyOn(NimbleRoll.prototype, 'evaluate').mockImplementation(async function (this: NimbleRoll) {
		const die = (this.terms as unknown as Array<{ faces?: number; results?: unknown[] }>)[0];
		die.results = [
			{ result: 16, active: true },
			{ result: 3, active: false },
		];
		return this as never;
	});
});

describe('a reroll on a save card', () => {
	it('pays the cost, rolls with the roll mode change and records the d20 history', async () => {
		const { roller, rule } = setupWorld();
		const message = createSaveCard();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(rule.offersRerollOn).toHaveBeenCalledWith({
			side: 'roller',
			roll: { kind: 'save', key: 'will' },
		});
		expect(rule.rerollChanges).toHaveBeenCalledWith('save');
		expect(roller.system.attributes.wounds.value).toBe(1);
		expect(message.update).toHaveBeenCalledTimes(1);
		const written = payload(message);
		expect(written.rolls).toHaveLength(1);
		expect(JSON.parse(written.rolls[0]).formula).toBe('2d20khn + 3[Will]');
		expect(written.system.incomingReactions[0]).toMatchObject({ id: 'entry-1', used: true });
		expect(written.system.rerolls).toEqual([
			expect.objectContaining({
				entryId: 'entry-1',
				itemUuid: 'Item.head',
				actorUuid: ROLLER,
				faces: 20,
				previous: { value: 8, outcome: null },
				next: { value: 16, outcome: null },
				woundsGained: 1,
			}),
		]);
	});

	it('lets the owner of the roller use it through the GM', async () => {
		setupWorld();
		const message = createSaveCard();

		await message.resolveRerollReaction('entry-1', 'player-1', true);

		expect(message.update).toHaveBeenCalledTimes(1);
	});

	it('refuses a player who does not own the roller', async () => {
		const { roller } = setupWorld();
		roller.testUserPermission.mockReturnValue(false);
		const message = createSaveCard();

		await message.resolveRerollReaction('entry-1', 'player-1', true);

		expect(message.update).not.toHaveBeenCalled();
		expect(roller.system.attributes.wounds.value).toBe(0);
	});

	it('refuses, and charges nothing, when the rule no longer fits the check', async () => {
		const { roller, rule } = setupWorld();
		rule.offersRerollOn.mockReturnValue(false);
		const message = createSaveCard();

		await message.resolveRerollReaction('entry-1', 'gm-user');

		expect(message.update).not.toHaveBeenCalled();
		expect(roller.system.attributes.wounds.value).toBe(0);
		expect(globals().ui.notifications.warn).toHaveBeenCalledWith(
			localize('NIMBLE.chat.incomingReactions.rerollNoLongerAvailable'),
		);
	});

	it('tells the card it can still use the entry', () => {
		setupWorld();
		const message = createSaveCard();

		expect(message.canStillUseReroll(entry() as never)).toBe(true);
	});

	it('gives a card posted before rerolls nothing to use', () => {
		setupWorld();
		const message = createSaveCard({ actorUuid: null, tokenUuid: null, incomingReactions: [] });

		expect(message.canStillUseReroll(entry() as never)).toBe(false);
	});
});
