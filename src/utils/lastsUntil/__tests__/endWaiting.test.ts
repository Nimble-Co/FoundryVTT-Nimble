import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent, WaitingEndAction } from '#types/cardEvent.d.ts';
import type { Moment } from '../momentReached.js';

const effects = new Map<string, { id: string; uuid: string }>();
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
// The GM deletes the effects it ends.
const endEffects = vi.fn(async (ended: Array<{ id: string }>, _moment?: unknown) => {
	for (const effect of ended) effects.delete(effect.id);
	return true;
});
const escapeOnEnd = vi.fn(async (_rollId: string, target: { effectId: string }) => {
	effects.delete(target.effectId);
	return true;
});
const askActiveGm = vi.fn(async (..._args: unknown[]): Promise<unknown> => true);

// Setup loads these modules before a hoisted mock could apply.
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({ endEffects }));
vi.doMock('#utils/lastsUntil/escapeFollow.js', () => ({ escapeOnEnd }));
vi.doMock('#utils/askActiveGm.js', () => ({ askActiveGm }));
const { canEndWaiting, endWaiting } = await import('../endWaiting.js');

const NEXT_TURN_END = { kind: 'turn', boundary: 'end', span: 'nextTurn' } as Moment;

const tessa = {
	uuid: 'Actor.tessa',
	name: 'Tessa',
	isOwner: false,
	effects: { get: (id: string) => effects.get(id) },
};

function waitingLine(fields: Partial<WaitingEndAction> = {}): CardEvent {
	return {
		id: 'wait1',
		kind: 'waitingEnd',
		img: 'blind.svg',
		text: {
			key: 'NIMBLE.lastsUntil.chat.endsOn',
			data: { effect: 'Blinded', name: 'Tessa' },
		},
		action: {
			kind: 'waitingEnd',
			holderUuid: 'Actor.tessa',
			holderName: 'Tessa',
			effectId: 'blind',
			effectName: 'Blinded',
			state: 'waiting',
			end: { key: 'turn:1', heading: { key: 'End of turn' } },
			endedBy: NEXT_TURN_END,
			...fields,
		},
		at: 5,
	};
}

function cardWith(id: string, line: CardEvent) {
	return { id, flags: { [SYSTEM_ID]: { events: [line] } } };
}

const game = (globalThis as unknown as { game: Record<string, unknown> }).game;

beforeEach(() => {
	vi.clearAllMocks();
	replaceCardEvent.mockResolvedValue(true);
	effects.clear();
	effects.set('blind', { id: 'blind', uuid: 'Actor.tessa.ActiveEffect.blind' });
	tessa.isOwner = false;
	game.user = { id: 'gm', isGM: true, isActiveGM: true };
	vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === tessa.uuid ? tessa : null));
});

afterEach(() => vi.unstubAllGlobals());

describe('endWaiting', () => {
	it('marks the line while it still waits, then ends the effect in its place', async () => {
		const line = waitingLine();
		const card = cardWith('turnCard', line);
		const blind = effects.get('blind');

		expect(await endWaiting(card, line)).toBe(true);

		expect(replaceCardEvent).toHaveBeenNthCalledWith(
			1,
			card,
			'wait1',
			expect.objectContaining({ action: expect.objectContaining({ state: 'ending' }) }),
			{ ifState: 'waiting' },
		);
		expect(endEffects).toHaveBeenCalledWith([blind], {
			key: 'turn:1',
			heading: { key: 'End of turn' },
			hostId: 'turnCard',
			replaces: { eventId: 'wait1', at: 5 },
			endedBy: { 'Actor.tessa.ActiveEffect.blind': NEXT_TURN_END },
		});
		expect(replaceCardEvent).toHaveBeenCalledOnce();
	});

	it('a second click finds the line marked and ends nothing', async () => {
		replaceCardEvent.mockResolvedValueOnce(false);
		const line = waitingLine();

		expect(await endWaiting(cardWith('turnCard', line), line)).toBe(false);
		expect(endEffects).not.toHaveBeenCalled();
	});

	it('an effect that is gone already: the line says so and has no button', async () => {
		effects.clear();
		const line = waitingLine();
		const card = cardWith('turnCard', line);

		expect(await endWaiting(card, line)).toBe(true);

		expect(endEffects).not.toHaveBeenCalled();
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'wait1', {
			...line,
			text: { key: 'NIMBLE.lastsUntil.chat.notOn', data: { effect: 'Blinded', name: 'Tessa' } },
			action: { ...(line.action as WaitingEndAction), state: 'gone' },
		});
	});

	it('an end that did not take puts the line back to waiting', async () => {
		endEffects.mockResolvedValueOnce(false);
		const line = waitingLine();
		const card = cardWith('turnCard', line);

		expect(await endWaiting(card, line)).toBe(false);
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'wait1', line, { ifState: 'ending' });
	});

	it('an error puts the line back to waiting', async () => {
		endEffects.mockRejectedValueOnce(new Error('locked'));
		const line = waitingLine();
		const card = cardWith('turnCard', line);

		await expect(endWaiting(card, line)).rejects.toThrow('locked');
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'wait1', line, { ifState: 'ending' });
	});

	it('a line that is not waiting does nothing', async () => {
		const line = waitingLine({ state: 'gone' });

		expect(await endWaiting(cardWith('turnCard', line), line)).toBe(false);
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});
});

describe('endWaiting for a player', () => {
	beforeEach(() => {
		game.user = { id: 'player', isGM: false, isActiveGM: false };
	});

	it('the owner of the holder asks the active GM to end it', async () => {
		tessa.isOwner = true;
		const line = waitingLine();

		expect(canEndWaiting(line.action as WaitingEndAction)).toBe(true);
		expect(await endWaiting(cardWith('turnCard', line), line)).toBe(true);
		expect(askActiveGm).toHaveBeenCalledWith(`${SYSTEM_ID}.endWaiting`, {
			messageId: 'turnCard',
			eventId: 'wait1',
		});
		expect(endEffects).not.toHaveBeenCalled();
	});

	it('another player cannot end it', async () => {
		const line = waitingLine();

		expect(canEndWaiting(line.action as WaitingEndAction)).toBe(false);
		expect(await endWaiting(cardWith('turnCard', line), line)).toBe(false);
		expect(askActiveGm).not.toHaveBeenCalled();
	});
});

describe('endWaiting for an Escape that passed', () => {
	const escapeLine = () =>
		waitingLine({
			end: { heading: { key: 'Escape' }, hostId: 'roll1', reason: { key: 'Escaped' } },
			endedBy: undefined,
			escapeRollId: 'roll1',
		});

	it('escapes on the roll card, in place of the line', async () => {
		const line = escapeLine();

		expect(await endWaiting(cardWith('roll1', line), line)).toBe(true);

		expect(endEffects).not.toHaveBeenCalled();
		expect(escapeOnEnd).toHaveBeenCalledWith(
			'roll1',
			line.action,
			{ key: 'Escaped' },
			{ hostId: 'roll1', eventId: 'wait1' },
			{ eventId: 'wait1', at: 5 },
		);
	});

	it('an escape that a reroll took back ends nothing, and its line is not put back', async () => {
		escapeOnEnd.mockResolvedValueOnce(false);
		const line = escapeLine();
		const card = cardWith('roll1', line);

		expect(await endWaiting(card, line)).toBe(false);

		expect(effects.has('blind')).toBe(true);
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'wait1', line, { ifState: 'ending' });
	});

	it('a line that moved for its readers escapes on the roll card and goes', async () => {
		const line = escapeLine();
		const card = cardWith('forTessa', line);

		expect(await endWaiting(card, line)).toBe(true);

		expect(escapeOnEnd).toHaveBeenCalledWith(
			'roll1',
			line.action,
			{ key: 'Escaped' },
			{ hostId: 'forTessa', eventId: 'wait1' },
			undefined,
		);
		expect(replaceCardEvent).toHaveBeenLastCalledWith(card, 'wait1', null);
	});
});
