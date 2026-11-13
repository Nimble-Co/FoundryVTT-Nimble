import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardEvent } from '#types/cardEvent.d.ts';
import type { EffectPayload } from '#types/effectPayload.d.ts';

const createEffect = vi.fn();
const addCardEvents = vi.fn(async (..._args: unknown[]) => true);
const addMomentEvents = vi.fn(async (..._args: unknown[]) => true);

let applyEffectToActor: typeof import('../applyEffectToActor.js').applyEffectToActor;

const turnMoment = {
	kind: 'turn',
	boundary: 'end',
	clock: 'holder',
	span: 'nextTurn',
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
} as const;

const stacks = (count: number, at: number | null) => ({
	on: true,
	count,
	at,
	effectId: at ? 'stone' : '',
});

function stackingPayload(at: number | null, cardId: string | null): EffectPayload {
	return {
		data: {
			name: 'Snowblind',
			statuses: [],
			system: { lastsUntil: [turnMoment], stacks: stacks(1, at) },
		},
		sourceItemUuid: 'Actor.basilisk.Item.gaze',
		sourceActorUuid: 'Actor.basilisk',
		cardId,
	};
}

function copyWith(count: number) {
	const copy = {
		id: 'snow',
		uuid: 'Actor.goblin.ActiveEffect.snow',
		name: 'Snowblind',
		origin: 'Actor.basilisk.Item.gaze',
		statuses: new Set<string>(),
		system: { lastsUntil: [turnMoment], stacks: stacks(count, 3) },
		update: vi.fn(async (changes: Record<string, number>) => {
			copy.system.stacks.count = changes['system.stacks.count'];
		}),
	};
	return copy;
}

function goblin(effects: object[]) {
	return {
		uuid: 'Actor.goblin',
		name: 'Goblin',
		isOwner: true,
		effects,
		system: { attributes: { hp: { temp: 0 } } },
		update: vi.fn(async () => undefined),
	};
}

const stone = {
	transfer: false,
	toObject: () => ({ _id: 'stone', name: 'Stone', img: 'stone.webp', statuses: [], system: {} }),
};
const gaze = {
	uuid: 'Actor.basilisk.Item.gaze',
	effects: { get: (id: string) => (id === 'stone' ? stone : null) },
};
const card = { id: 'card1' };

const linesOf = (mock: typeof addCardEvents) =>
	mock.mock.calls.flatMap((call) => call[1] as CardEvent[]);

beforeEach(async () => {
	createEffect.mockReset().mockResolvedValue({ uuid: 'Actor.goblin.ActiveEffect.new' });
	addCardEvents.mockClear();
	addMomentEvents.mockClear();
	vi.resetModules();
	vi.doMock('#utils/chat/cardEvents.js', async (importOriginal) => ({
		...(await importOriginal<object>()),
		addCardEvents,
		addMomentEvents,
	}));
	({ applyEffectToActor } = await import('../applyEffectToActor.js'));
	vi.doUnmock('#utils/chat/cardEvents.js');
	vi.stubGlobal(
		'fromUuid',
		vi.fn(async (uuid: string) => (uuid === gaze.uuid ? gaze : { uuid })),
	);
	(CONFIG as unknown as { ActiveEffect: object }).ActiveEffect = {
		documentClass: { create: createEffect, getEffectStart: () => ({ time: 0 }) },
	};
	(game as unknown as { messages: object }).messages = {
		get: (id: string) => (id === card.id ? card : undefined),
	};
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('the "At N stacks" line, from the stack-up', () => {
	it('goes on the card that caused the application', async () => {
		await applyEffectToActor(goblin([copyWith(2)]), stackingPayload(3, 'card1'));

		expect(addCardEvents).toHaveBeenCalledTimes(1);
		expect(addCardEvents.mock.calls[0][0]).toBe(card);
		const [line] = linesOf(addCardEvents);
		expect(line).toMatchObject({
			kind: 'stackGain',
			text: { key: 'NIMBLE.chat.stackGain.gains' },
			action: { state: 'gained', gainedUuid: 'Actor.goblin.ActiveEffect.new', count: 3 },
		});
		expect(addMomentEvents).not.toHaveBeenCalled();
	});

	it('with no card (a pool spend, a turn), goes on a card of its own for the holder', async () => {
		await applyEffectToActor(goblin([copyWith(2)]), stackingPayload(3, null));

		expect(addCardEvents).not.toHaveBeenCalled();
		expect(addMomentEvents).toHaveBeenCalledTimes(1);
		const [moment, lines] = addMomentEvents.mock.calls[0] as [
			{ key: string; heading: unknown },
			CardEvent[],
		];
		expect(moment.key).toMatch(/^once:/);
		expect(moment.heading).toEqual({
			key: 'NIMBLE.chat.events.forHeading',
			data: { names: 'Goblin' },
		});
		expect(lines.map((line) => line.kind)).toEqual(['stackGain']);
	});

	it('is not written below the count, or past it', async () => {
		await applyEffectToActor(goblin([copyWith(1)]), stackingPayload(3, 'card1'));
		await applyEffectToActor(goblin([copyWith(3)]), stackingPayload(3, 'card1'));

		expect(addCardEvents).not.toHaveBeenCalled();
		expect(addMomentEvents).not.toHaveBeenCalled();
	});
});
