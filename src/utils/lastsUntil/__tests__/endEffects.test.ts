import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type EndedEffectRow,
	effectsEndingAt,
	endEffects,
	everyActor,
	undoEndedEffect,
} from '../endEffects.js';
import type { LastsUntilCheck, Moment } from '../momentReached.js';

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
	it('on the active GM, deletes the effects and posts one message with a row each', async () => {
		const a = addEffect(goblin, 'a');
		const b = addEffect(goblin, 'b');
		const c = addEffect(ogre, 'c');

		await endEffects([a, b, c], 'Start of Tessa turn');

		expect(goblin.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['a', 'b']);
		expect(ogre.holder.deleteEmbeddedDocuments).toHaveBeenCalledWith('ActiveEffect', ['c']);
		expect(create).toHaveBeenCalledTimes(1);
		const { system, type } = create.mock.calls[0][0];
		expect(type).toBe('effectsEnded');
		expect(system.heading).toBe('Start of Tessa turn');
		expect(system.rows.map((row: EndedEffectRow) => [row.name, row.holderName])).toEqual([
			['Effect a', 'Goblin'],
			['Effect b', 'Goblin'],
			['Effect c', 'Ogre'],
		]);
		expect(system.rows[0].effect).toEqual({ _id: 'a', name: 'Effect a' });
	});

	it('skips an effect that is gone already, and posts nothing when none is left', async () => {
		const gone = addEffect(goblin, 'gone');
		goblin.effects.delete('gone');

		await endEffects([gone], 'Heading');

		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
		expect(create).not.toHaveBeenCalled();
	});

	it('on another client, asks the active GM', async () => {
		user.isActiveGM = false;
		const a = addEffect(goblin, 'a');

		await endEffects([a], 'Goblin attacked');

		expect(activeGM?.query).toHaveBeenCalledWith('nimble.endTimedEffects', {
			uuids: [a.uuid],
			heading: 'Goblin attacked',
		});
		expect(goblin.holder.deleteEmbeddedDocuments).not.toHaveBeenCalled();
	});

	it('with no GM online, ends nothing', async () => {
		user.isActiveGM = false;
		activeGM = null;

		await endEffects([addEffect(goblin, 'a')], 'Goblin attacked');

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
