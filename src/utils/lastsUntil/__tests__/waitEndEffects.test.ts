import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent, WaitingEndAction } from '#types/cardEvent.d.ts';
import type { LastsUntilCheck, Moment } from '../momentReached.js';

const poolLine: CardEvent = {
	id: 'pool',
	kind: 'emptyPool',
	icon: 'fa-solid fa-dice',
	text: { key: 'pool' },
	at: 1,
};
const emptyPoolEvents = vi.fn((..._args: unknown[]): CardEvent[] => []);

// Setup loads these modules before a hoisted mock could apply.
vi.resetModules();
vi.doMock('#utils/dicePool/emptyPoolLine.js', () => ({
	END_LINES_OPTION: 'nimbleEndLines',
	emptyPoolEvents,
}));
const { endEffects, undoEndedEffect } = await import('../endEffects.js');
const { endEffectsAt } = await import('../endEffectsAt.js');
const { waitEndEffects } = await import('../waitEndEffects.js');

const UNTIL_THEY_ATTACK: Moment = {
	kind: 'event',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: 'holder',
	event: 'attack',
	effectName: '',
	damageTypes: [],
};

interface CreatedCard {
	system: { momentKey: string };
	flags: Record<string, { events: CardEvent[] }>;
}

function makeHolder(uuid: string, name: string) {
	const effects = new Map<string, ActiveEffect>();
	const holder = Object.assign(Object.create(Actor.prototype), {
		uuid,
		name,
		effects: {
			get: (id: string) => effects.get(id),
			[Symbol.iterator]: () => effects.values(),
		},
		deleteEmbeddedDocuments: vi.fn(async (_name: string, ids: string[]) => {
			for (const id of ids) effects.delete(id);
		}),
	});
	return { holder, effects };
}

function addEffect(target: ReturnType<typeof makeHolder>, id: string) {
	const effect = Object.assign(Object.create(ActiveEffect.prototype), {
		id,
		uuid: `${target.holder.uuid}.ActiveEffect.${id}`,
		name: `Effect ${id}`,
		img: `icons/${id}.svg`,
		parent: target.holder,
		active: true,
		origin: null,
		isTemporary: false,
		lastsUntil: [UNTIL_THEY_ATTACK],
		flags: {} as Record<string, Record<string, unknown>>,
		toObject: () => ({ _id: id }),
		update: vi.fn(async (changes: Record<string, unknown>) => {
			for (const [path, value] of Object.entries(changes)) {
				foundry.utils.setProperty(effect, path, value);
			}
		}),
	});
	target.effects.set(id, effect);
	return effect as ActiveEffect & { update: ReturnType<typeof vi.fn> };
}

let goblin: ReturnType<typeof makeHolder>;
let create: ReturnType<typeof vi.fn>;
let automation: boolean;
let messages: Array<{
	id: string;
	flags: Record<string, unknown>;
	update: ReturnType<typeof vi.fn>;
}>;

const createdCard = (index = 0) => create.mock.calls[index][0] as CreatedCard;
const linesOf = (card: CreatedCard) => card.flags[SYSTEM_ID].events;

function hostCard(id: string, events: CardEvent[] = []) {
	const card = {
		id,
		type: 'feature',
		flags: { [SYSTEM_ID]: { events } } as Record<string, unknown>,
		update: vi.fn(async (changes: Record<string, unknown>) => {
			card.flags = { [SYSTEM_ID]: { events: changes[`flags.${SYSTEM_ID}.events`] } };
		}),
	};
	messages.push(card);
	return card;
}
const eventsOn = (card: { flags: Record<string, unknown> }) =>
	(card.flags[SYSTEM_ID] as { events: CardEvent[] }).events;

beforeEach(() => {
	goblin = makeHolder('Actor.goblin', 'Goblin');
	create = vi.fn(async () => ({}));
	Object.assign(ChatMessage, { create });
	automation = false;
	messages = [];
	emptyPoolEvents.mockReset();
	emptyPoolEvents.mockReturnValue([]);
	const g = globalThis as unknown as { game: Record<string, unknown> };
	Object.assign(g.game, {
		user: { id: 'gm', name: 'Gamemaster', isGM: true, isActiveGM: true },
		actors: [goblin.holder],
		scenes: [],
		settings: { get: () => automation },
		messages: {
			get contents() {
				return messages;
			},
			get: (id: string) => messages.find((card) => card.id === id),
		},
		users: { activeGM: { query: vi.fn(async () => true) } },
	});
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => (uuid === goblin.holder.uuid ? goblin.holder : null)),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete (globalThis as unknown as { game: Record<string, unknown> }).game.settings;
	delete (ChatMessage as unknown as { create?: unknown }).create;
});

const attackBy = (actor: object): LastsUntilCheck => ({ type: 'event', event: 'attack', actor });

describe('waitEndEffects', () => {
	it('posts a waiting line with End for each effect and ends nothing', async () => {
		const a = addEffect(goblin, 'a');

		await waitEndEffects([a], { key: 'turn:1', heading: { key: 'Start of turn' } });

		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		const [line] = linesOf(createdCard());
		expect(line.kind).toBe('waitingEnd');
		expect(line.text).toEqual({
			key: 'NIMBLE.lastsUntil.chat.endsOn',
			data: { effect: 'Effect a', name: 'Goblin' },
		});
		expect(line.action).toEqual({
			kind: 'waitingEnd',
			holderUuid: 'Actor.goblin',
			holderName: 'Goblin',
			effectId: 'a',
			effectName: 'Effect a',
			state: 'waiting',
			end: { key: 'turn:1', heading: { key: 'Start of turn' } },
		});
	});

	it('the line goes on the card that caused it, with the Lasts Until words as its cause', async () => {
		const card = hostCard('attack1');
		const a = addEffect(goblin, 'a');

		await waitEndEffects(
			[a],
			{ heading: { key: 'Goblin attacked' }, hostId: 'attack1' },
			{ check: attackBy(goblin.holder) },
		);

		expect(create).not.toHaveBeenCalled();
		const [line] = eventsOn(card);
		expect(line.cause).toEqual({
			key: 'NIMBLE.chat.events.cause.lastsUntil',
			data: { moment: { lastsUntil: UNTIL_THEY_ATTACK } },
		});
		expect((line.action as WaitingEndAction).endedBy).toEqual(UNTIL_THEY_ATTACK);
	});

	it('a line with no host and no moment card keeps the key of the card it made', async () => {
		await waitEndEffects([addEffect(goblin, 'a')], { heading: { key: 'Goblin attacked' } });

		const card = createdCard();
		const action = linesOf(card)[0].action as WaitingEndAction;
		expect(action.end.key).toMatch(/^once:/);
		expect(card.system.momentKey).toBe(action.end.key);
	});

	it('an event gives a line each time it happens while the effect is on', async () => {
		const a = addEffect(goblin, 'a');

		await waitEndEffects([a], { heading: { key: 'First attack' } });
		await waitEndEffects([a], { heading: { key: 'Second attack' } });

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('a one-time moment gives its line once', async () => {
		const a = addEffect(goblin, 'a');

		await waitEndEffects([a], { key: 'turn:1', heading: { key: 'Turn' } }, undefined, {
			once: true,
		});
		await waitEndEffects([a], { key: 'turn:2', heading: { key: 'Turn' } }, undefined, {
			once: true,
		});

		expect(create).toHaveBeenCalledTimes(1);
		expect(a.update).toHaveBeenCalledWith({ [`flags.${SYSTEM_ID}.endWaits.moment`]: true });
	});

	it('each one-time moment gives its own line once', async () => {
		const a = addEffect(goblin, 'a');
		const turn = { key: 'turn:1', heading: { key: 'Turn' } };

		await waitEndEffects([a], turn, undefined, { once: 'inactiveRound' });
		await waitEndEffects([a], turn, undefined, { once: 'inactiveRound' });
		await waitEndEffects([a], { key: 'turn:2', heading: { key: 'Turn' } }, undefined, {
			once: true,
		});

		expect(create).toHaveBeenCalledTimes(2);
	});

	it('skips an effect that is gone', async () => {
		const a = addEffect(goblin, 'a');
		goblin.effects.delete('a');

		await waitEndEffects([a], { heading: { key: 'Turn' } });

		expect(create).not.toHaveBeenCalled();
	});
});

describe('endEffectsAt with Feature Effects off', () => {
	it('posts the waiting lines of a moment once, and ends nothing', async () => {
		addEffect(goblin, 'a');
		const moment = { key: 'worldTime', heading: { key: 'Time passed' } };

		await endEffectsAt(attackBy(goblin.holder), moment);
		await endEffectsAt(attackBy(goblin.holder), moment);

		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledTimes(1);
		expect(linesOf(createdCard())[0].kind).toBe('waitingEnd');
	});

	it('a Minor Status that gave the line of its moment still gives one at combat end', async () => {
		const a = addEffect(goblin, 'a');
		Object.assign(a, { isMinor: true, start: { combat: 'combat1', time: 0 } });
		const combatEnd: LastsUntilCheck = { type: 'combatEnd', combatId: 'combat1', started: true };

		await endEffectsAt(attackBy(goblin.holder), { key: 'k1', heading: { key: 'Time passed' } });
		await endEffectsAt(combatEnd, { key: 'k2', heading: { key: 'Combat ends' } });
		await endEffectsAt(combatEnd, { key: 'k3', heading: { key: 'Combat ends' } });

		expect(create).toHaveBeenCalledTimes(2);
		expect(linesOf(createdCard(1))[0].kind).toBe('waitingEnd');
		expect(a.flags[SYSTEM_ID].endWaits).toEqual({ lastsUntil0: true, 'minor-combat1': true });
	});

	it('with Feature Effects on, ends as before', async () => {
		automation = true;
		addEffect(goblin, 'a');

		await endEffectsAt(attackBy(goblin.holder), { key: 'k', heading: { key: 'Time passed' } });

		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a']);
	});
});

describe('undoEndedEffect', () => {
	it('the copy that comes back gives its waiting lines again', async () => {
		const created = vi.fn(async (..._args: unknown[]) => ({}));
		const implementation = (ActiveEffect as unknown as { implementation?: unknown }).implementation;
		Object.assign(ActiveEffect, { implementation: { create: created } });
		const effect = {
			_id: 'a',
			flags: { [SYSTEM_ID]: { endWaits: { lastsUntil0: true }, turnsSeen: [1] } },
		};

		try {
			await undoEndedEffect({
				effectId: 'a',
				holderUuid: 'Actor.goblin',
				holderName: 'Goblin',
				name: 'Effect a',
				img: '',
				sourceName: '',
				effect,
			});
		} finally {
			Object.assign(ActiveEffect, { implementation });
		}

		expect(created).toHaveBeenCalledWith(
			{ _id: 'a', flags: { [SYSTEM_ID]: { turnsSeen: [1] } } },
			expect.objectContaining({ parent: goblin.holder, keepId: true }),
		);
		expect(effect.flags[SYSTEM_ID].endWaits).toEqual({ lastsUntil0: true });
	});
});

describe('endEffects in place of a waiting line', () => {
	it('the ended line takes the place of the waiting line, with its time', async () => {
		const waiting: CardEvent = {
			id: 'wait1',
			kind: 'waitingEnd',
			icon: 'fa-solid fa-hourglass-half',
			text: { key: 'x' },
			at: 5,
		};
		const card = hostCard('turnCard', [
			{ ...waiting, id: 'before', at: 1 },
			waiting,
			{ ...waiting, id: 'after', at: 9 },
		]);
		const a = addEffect(goblin, 'a');

		await endEffects([a], {
			heading: { key: 'Turn' },
			hostId: 'turnCard',
			replaces: { eventId: 'wait1', at: 5 },
		});

		const events = eventsOn(card);
		expect(events.map((event) => event.kind)).toEqual(['waitingEnd', 'effectEnded', 'waitingEnd']);
		expect(events[1]).toEqual(
			expect.objectContaining({ id: 'effectEnded.Actor.goblin.a.5', at: 5 }),
		);
		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalled();
	});
});

describe('the pools of an ended effect', () => {
	it('with Feature Effects off, their waiting lines follow the ended lines', async () => {
		emptyPoolEvents.mockImplementation((_effects, at) => [{ ...poolLine, at: at as number }]);
		const card = hostCard('stepCard');
		const a = addEffect(goblin, 'a');

		await endEffects([a], { heading: { key: 'Step' }, hostId: 'stepCard' });

		expect(eventsOn(card).map((event) => event.kind)).toEqual(['effectEnded', 'emptyPool']);
		expect(emptyPoolEvents).toHaveBeenCalledWith([a], expect.any(Number));
		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a'], {
			nimbleEndLines: true,
		});
	});

	it('with Feature Effects on, the delete empties them and no line is made', async () => {
		automation = true;
		hostCard('stepCard');

		await endEffects([addEffect(goblin, 'a')], { heading: { key: 'Step' }, hostId: 'stepCard' });

		expect(emptyPoolEvents).not.toHaveBeenCalled();
		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a']);
	});
});
