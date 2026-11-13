import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent, StackGainAction } from '#types/cardEvent.d.ts';
import type { StackReached } from '../applyEffectToActor.js';

const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const applyEffectToActor = vi.fn();

let line: typeof import('../stackGainLine.js');

const tessa = { uuid: 'Actor.tessa', name: 'Tessa', isOwner: true };
const card = { id: 'gaze-card' };
const gained = { name: 'Petrified', statuses: ['petrified'] };
const reached = (fields: Partial<StackReached> = {}): StackReached => ({
	count: 3,
	stackedName: 'Dazed',
	gainedName: 'Petrified',
	img: 'petrified.svg',
	...fields,
});

const replaced = () => replaceCardEvent.mock.calls.at(-1)?.[2] as CardEvent;

beforeEach(async () => {
	replaceCardEvent.mockClear();
	applyEffectToActor.mockReset().mockResolvedValue({
		effectUuid: 'Actor.tessa.ActiveEffect.stone',
		actorName: 'Tessa',
	});
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		replaceCardEvent,
	}));
	vi.doMock('#utils/actor/applyEffectToActor.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		applyEffectToActor,
	}));
	line = await import('../stackGainLine.js');
	vi.doUnmock('#utils/chat/cardEvents.js');
	vi.doUnmock('#utils/actor/applyEffectToActor.js');
	vi.stubGlobal(
		'fromUuidSync',
		vi.fn(() => tessa),
	);
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('stackGainEvent', () => {
	it('says what the holder gained, with Undo', () => {
		const event = line.stackGainEvent(
			tessa,
			reached({ gainedUuid: 'Actor.tessa.ActiveEffect.stone' }),
			5,
		);

		expect(event).toMatchObject({
			id: 'stackGain.Actor.tessa.5',
			kind: 'stackGain',
			img: 'petrified.svg',
			text: {
				key: 'NIMBLE.chat.stackGain.gains',
				data: { name: 'Tessa', effect: 'Petrified', count: 3, stacked: 'Dazed' },
			},
			action: { kind: 'stackGain', state: 'gained', gainedUuid: 'Actor.tessa.ActiveEffect.stone' },
		});
	});

	it('with Feature Effects off, says the count and waits for a click', () => {
		const payload = { data: gained, sourceItemUuid: null, sourceActorUuid: null };
		const event = line.stackGainEvent(tessa, reached({ payload }), 5);

		expect(event.text).toEqual({
			key: 'NIMBLE.chat.stackGain.has',
			data: { name: 'Tessa', count: 3, stacked: 'Dazed' },
		});
		expect(event.action).toMatchObject({ state: 'waiting', payload });
	});

	it('with no effect to gain, only says the count', () => {
		const event = line.stackGainEvent(tessa, reached({ gainedName: '', img: undefined }), 5);

		expect(event.text.key).toBe('NIMBLE.chat.stackGain.has');
		expect(event).not.toHaveProperty('action');
		expect(event.icon).toBe('fa-solid fa-layer-group');
	});
});

describe('the clicks of the line', () => {
	const waiting = () =>
		line.stackGainEvent(
			tessa,
			reached({ payload: { data: gained, sourceItemUuid: null, sourceActorUuid: null } }),
			5,
		);

	it('a click on a waiting line puts the effect on, and the line says so', async () => {
		await line.actOnStackGain(card, waiting());

		expect(applyEffectToActor).toHaveBeenCalledWith(tessa, {
			data: gained,
			sourceItemUuid: null,
			sourceActorUuid: null,
		});
		expect(replaced().text.key).toBe('NIMBLE.chat.stackGain.gains');
		expect(replaced().action).toMatchObject({
			state: 'gained',
			gainedUuid: 'Actor.tessa.ActiveEffect.stone',
		});
	});

	it('Undo takes the gained effect off', async () => {
		const stone = { delete: vi.fn(async () => undefined) };
		vi.stubGlobal(
			'fromUuidSync',
			vi.fn((uuid: string) => (uuid === 'Actor.tessa' ? tessa : stone)),
		);
		const event = line.stackGainEvent(
			tessa,
			reached({ gainedUuid: 'Actor.tessa.ActiveEffect.stone' }),
			5,
		);

		await line.actOnStackGain(card, event);

		expect(stone.delete).toHaveBeenCalled();
		expect((replaced().action as StackGainAction).state).toBe('undone');
	});

	it('only the owner of the creature or a GM can click', () => {
		const action = waiting().action as StackGainAction;
		expect(line.canActOnStackGain(action)).toBe(true);

		vi.stubGlobal(
			'fromUuidSync',
			vi.fn(() => ({ ...tessa, isOwner: false })),
		);
		expect(line.canActOnStackGain(action)).toBe(false);
	});
});
