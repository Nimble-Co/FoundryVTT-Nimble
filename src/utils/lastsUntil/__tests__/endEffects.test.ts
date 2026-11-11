import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';
import {
	type EndedEffectRow,
	effectsEndingAt,
	endEffects,
	everyActor,
	undoEndedEffect,
} from '../endEffects.js';
import type { LastsUntilCheck, Moment } from '../momentReached.js';

const moment = (text: string, key?: string) => ({
	...(key ? { key } : {}),
	heading: { key: text },
});

interface CreatedCard {
	type: string;
	system: { momentKey: string; momentHeading: { key: string } };
	flags: Record<string, { events: CardEvent[] }>;
}

const createdCard = (index = 0) => create.mock.calls[index][0] as CreatedCard;
const rowsOf = (card: CreatedCard) =>
	card.flags[SYSTEM_ID].events.map((event) => (event.action as { row: EndedEffectRow }).row);

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
};

function makeHolder(uuid: string, name: string) {
	const effects = new Map<string, ActiveEffect>();
	const holder = Object.assign(Object.create(Actor.prototype), {
		uuid,
		name,
		isOwner: false,
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

function addEffect(
	target: ReturnType<typeof makeHolder>,
	id: string,
	fields: Record<string, unknown> = {},
) {
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
		toObject: () => ({ _id: id, name: `Effect ${id}` }),
		...fields,
	}) as ActiveEffect;
	target.effects.set(id, effect);
	return effect;
}

let goblin: ReturnType<typeof makeHolder>;
let ogre: ReturnType<typeof makeHolder>;
let create: ReturnType<typeof vi.fn>;
let user: { id: string; name: string; isGM: boolean; isActiveGM: boolean };
let activeGM: { query: ReturnType<typeof vi.fn> } | null;

beforeEach(() => {
	goblin = makeHolder('Scene.s.Token.t.Actor.goblin', 'Goblin');
	ogre = makeHolder('Actor.ogre', 'Ogre');
	create = vi.fn(async () => ({}));
	Object.assign(ChatMessage, { create });
	user = { id: 'gm', name: 'Gamemaster', isGM: true, isActiveGM: true };
	activeGM = { query: vi.fn(async () => true) };
	const g = globalThis as unknown as { game: Record<string, unknown> };
	Object.assign(g.game, {
		user,
		actors: [ogre.holder],
		scenes: [
			{
				tokens: [
					{ actorLink: false, actor: goblin.holder },
					{ actorLink: true, actor: ogre.holder },
				],
			},
		],
		messages: { contents: [] },
		users: {
			get activeGM() {
				return activeGM;
			},
		},
	});
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn((uuid: string) => [goblin.holder, ogre.holder].find((actor) => actor.uuid === uuid)),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete (ChatMessage as unknown as { create?: unknown }).create;
});

const attackBy = (actor: object): LastsUntilCheck => ({ type: 'event', event: 'attack', actor });

describe('everyActor', () => {
	it('yields the world actors and the actors of unlinked tokens, each once', () => {
		expect([...everyActor()]).toEqual([ogre.holder, goblin.holder]);
	});
});

describe('effectsEndingAt', () => {
	it('finds the effects that end, on every actor', () => {
		const ends = addEffect(goblin, 'blind');
		addEffect(ogre, 'other');

		expect(effectsEndingAt(attackBy(goblin.holder))).toEqual([ends]);
	});
});

describe('endEffects', () => {
	it('on the active GM, deletes the effects and posts one moment card with a line each', async () => {
		const a = addEffect(goblin, 'a');
		const b = addEffect(goblin, 'b');
		const c = addEffect(ogre, 'c');

		await endEffects([a, b, c], moment('Start of Tessa turn', 'combat:1:0:turnStart'));

		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a', 'b']);
		expect(ogre.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['c']);
		expect(create).toHaveBeenCalledTimes(1);
		const card = createdCard();
		expect(card.type).toBe('effectsEnded');
		expect(card.system.momentKey).toBe('combat:1:0:turnStart');
		expect(card.system.momentHeading).toEqual({ key: 'Start of Tessa turn' });
		expect(card.flags[SYSTEM_ID].events.map((event) => event.kind)).toEqual([
			'effectEnded',
			'effectEnded',
			'effectEnded',
		]);
		expect(rowsOf(card).map((row) => [row.name, row.holderName])).toEqual([
			['Effect a', 'Goblin'],
			['Effect b', 'Goblin'],
			['Effect c', 'Ogre'],
		]);
		expect(rowsOf(card)[0].effect).toEqual({ _id: 'a', name: 'Effect a' });
	});

	it('the reason of the moment goes on each line', async () => {
		await endEffects([addEffect(goblin, 'a')], {
			key: 'k',
			heading: { key: 'End' },
			reason: { key: 'Idle' },
		});

		expect(createdCard().flags[SYSTEM_ID].events[0].cause).toEqual({ key: 'Idle' });
	});

	it('ends with no moment key get a card of their own each', async () => {
		await endEffects([addEffect(goblin, 'a')], moment('Goblin attacked'));
		await endEffects([addEffect(goblin, 'b')], moment('Goblin attacked'));

		expect(create).toHaveBeenCalledTimes(2);
		expect(createdCard(0).system.momentKey).not.toBe(createdCard(1).system.momentKey);
	});

	it('skips an effect that is gone already, and posts nothing when none is left', async () => {
		const gone = addEffect(goblin, 'gone');
		goblin.effects.delete('gone');

		await endEffects([gone], moment('Heading'));

		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('on another client, asks the active GM', async () => {
		user.isActiveGM = false;
		const a = addEffect(goblin, 'a');

		await endEffects([a], moment('Goblin attacked'));

		expect(activeGM?.query).toHaveBeenCalledWith(`${SYSTEM_ID}.endTimedEffects`, {
			uuids: [a.uuid],
			moment: moment('Goblin attacked'),
		});
		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('a failed delete is logged, not thrown, and the next moment still runs', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		goblin.holder.deleteEmbeddedDocuments.mockRejectedValueOnce(new Error('locked'));

		await expect(endEffects([addEffect(goblin, 'a')], moment('First'))).resolves.toBeUndefined();
		await endEffects([addEffect(goblin, 'b')], moment('Second'));

		expect(error).toHaveBeenCalled();
		expect(create).toHaveBeenCalledTimes(1);
		expect(createdCard().system.momentHeading).toEqual({ key: 'Second' });
	});

	it('a failed ask to the GM is logged, not thrown', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		user.isActiveGM = false;
		activeGM?.query.mockRejectedValueOnce(new Error('timeout'));

		await expect(endEffects([addEffect(goblin, 'a')], moment('Heading'))).resolves.toBeUndefined();
		expect(error).toHaveBeenCalled();
	});

	it('with no GM online, ends nothing', async () => {
		user.isActiveGM = false;
		activeGM = null;

		await endEffects([addEffect(goblin, 'a')], moment('Goblin attacked'));

		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});
});

describe('undoEndedEffect', () => {
	const row = (): EndedEffectRow => ({
		effectId: 'a',
		holderUuid: goblin.holder.uuid,
		holderName: 'Goblin',
		name: 'Blinded',
		img: '',
		sourceName: 'Pocket Sand',
		effect: { _id: 'a', name: 'Blinded', start: { round: 1 } },
	});

	let effectCreate: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		effectCreate = vi.fn(async () => ({}));
		Object.assign(ActiveEffect, { implementation: { create: effectCreate } });
	});

	afterEach(() => {
		delete (ActiveEffect as unknown as { implementation?: unknown }).implementation;
	});

	it('makes the effect again with its id and old start', async () => {
		expect(await undoEndedEffect(row())).toBe(true);
		expect(effectCreate).toHaveBeenCalledWith(row().effect, {
			parent: goblin.holder,
			keepId: true,
		});
	});

	it('a player who does not own the holder cannot undo', async () => {
		user.isGM = false;

		expect(await undoEndedEffect(row())).toBe(false);
		expect(effectCreate).not.toHaveBeenCalled();
	});

	it('the owner of the holder can undo', async () => {
		user.isGM = false;
		goblin.holder.isOwner = true;

		expect(await undoEndedEffect(row())).toBe(true);
	});

	it('does not make a second copy when the effect is back already', async () => {
		addEffect(goblin, 'a');

		expect(await undoEndedEffect(row())).toBe(true);
		expect(effectCreate).not.toHaveBeenCalled();
	});
});
