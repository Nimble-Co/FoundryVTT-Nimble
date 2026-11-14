import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import type { CardEvent } from '#types/cardEvent.d.ts';

const effects = new Map<string, unknown>();
// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async (..._args: unknown[]) => true);
const addCardEvents = vi.fn(async (..._args: unknown[]) => true);
const endEffects = vi.fn(async (ended: Array<{ id: string }>, _moment?: unknown) => {
	for (const effect of ended) effects.delete(effect.id);
	return true;
});
const undoEndedEffect = vi.fn(async () => true);
const waitingEndLine = vi.fn(
	(_effect: unknown, moment: unknown, extra: { escapeRollId?: string }): CardEvent => ({
		id: 'waitingEnd.new',
		kind: 'waitingEnd',
		icon: 'x',
		text: { key: 'NIMBLE.lastsUntil.chat.endsOn' },
		action: {
			kind: 'waitingEnd',
			holderUuid: 'Actor.tessa',
			holderName: 'Tessa',
			effectId: 'grab',
			effectName: 'Grappled',
			state: 'waiting',
			end: moment as never,
			...extra,
		},
		at: 3,
	}),
);
const escapeDamageRulesOf = vi.fn((_effect: unknown): unknown[] => []);
const dealEscapeDamage = vi.fn(async (..._args: unknown[]) => {});
const takeBackEscapeDamage = vi.fn(async (..._args: unknown[]) => {});
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({
	endEffects,
	undoEndedEffect,
	waitingEndLine,
}));
vi.doMock('#utils/damage/escapeDamage.js', () => ({
	escapeDamageRulesOf,
	dealEscapeDamage,
	takeBackEscapeDamage,
}));
const { escapeOnEnd, followEscape } = await import('../escapeFollow.js');

const link = {
	holderUuid: 'Actor.tessa',
	holderName: 'Tessa',
	effectId: 'grab',
	effectName: 'Grappled',
	noDc: false,
};
const grappled = { id: 'grab', name: 'Grappled', img: 'grab.svg' };
const tessa = { uuid: 'Actor.tessa', name: 'Tessa', effects };

const waitingLine = (rollId = 's1'): CardEvent => ({
	id: 'waitingEnd.Actor.tessa.grab.3',
	kind: 'waitingEnd',
	icon: 'x',
	text: { key: 'NIMBLE.lastsUntil.chat.endsOn' },
	action: {
		kind: 'waitingEnd',
		holderUuid: 'Actor.tessa',
		holderName: 'Tessa',
		effectId: 'grab',
		effectName: 'Grappled',
		state: 'waiting',
		end: { heading: { key: 'NIMBLE.escape.note' }, hostId: rollId },
		escapeRollId: rollId,
	},
	at: 3,
});

let card: {
	id: string;
	type: string;
	system: Record<string, unknown>;
	rolls: Array<{ total: number }>;
	flags: Record<string, any>;
};
const otherCards: Array<{ id: string; flags: Record<string, any> }> = [];
const game = globalThis as unknown as { game: Record<string, unknown> };

beforeEach(() => {
	vi.clearAllMocks();
	effects.clear();
	effects.set('grab', grappled);
	game.game.user = { isGM: true, isActiveGM: true };
	game.game.settings = { get: () => false };
	card = {
		id: 's1',
		type: 'savingThrow',
		system: { saveKey: 'dexterity', dc: 13 },
		rolls: [{ total: 14 }],
		flags: { [SYSTEM_ID]: { escapeRoll: link } },
	};
	otherCards.length = 0;
	game.game.messages = {
		get: (id: string) => [card, ...otherCards].find((each) => each.id === id) ?? null,
		get contents() {
			return [card, ...otherCards];
		},
	};
	vi.stubGlobal('fromUuidSync', (uuid: string) => (uuid === 'Actor.tessa' ? tessa : null));
});

afterEach(() => {
	vi.unstubAllGlobals();
	delete game.game.settings;
});

describe('followEscape with Feature Effects off', () => {
	it('a pass ends nothing: the roll card gets the waiting line with End', async () => {
		await followEscape({ messageId: 's1', outcome: 'pass' });

		expect(endEffects).not.toHaveBeenCalled();
		expect(dealEscapeDamage).not.toHaveBeenCalled();
		expect(waitingEndLine).toHaveBeenCalledWith(
			grappled,
			expect.objectContaining({
				heading: { key: 'NIMBLE.escape.note', data: { effect: 'Grappled' } },
				hostId: 's1',
				reason: expect.objectContaining({ key: 'NIMBLE.escape.chat.escaped' }),
			}),
			{ escapeRollId: 's1' },
		);
		expect(addCardEvents).toHaveBeenCalledWith(card, [
			expect.objectContaining({ id: 'waitingEnd.new' }),
		]);
	});

	it('a second pass adds no second waiting line', async () => {
		card.flags[SYSTEM_ID].events = [waitingLine()];

		await followEscape({ messageId: 's1', outcome: 'pass' });

		expect(addCardEvents).not.toHaveBeenCalled();
	});

	it('a reroll to a fail takes the waiting line off', async () => {
		card.flags[SYSTEM_ID].events = [waitingLine()];

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(replaceCardEvent).toHaveBeenCalledWith(card, 'waitingEnd.Actor.tessa.grab.3', null);
		expect(undoEndedEffect).not.toHaveBeenCalled();
	});

	it('a reroll to a fail takes off a waiting line that moved for its readers', async () => {
		const moved = { id: 'forTessa', flags: { [SYSTEM_ID]: { events: [waitingLine()] } } };
		otherCards.push(moved);

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(replaceCardEvent).toHaveBeenCalledWith(moved, 'waitingEnd.Actor.tessa.grab.3', null);
	});

	it('with no DC, a fail turns the waiting line into the failed line', async () => {
		card.flags[SYSTEM_ID].escapeRoll = { ...link, noDc: true };
		card.flags[SYSTEM_ID].events = [waitingLine()];

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(replaceCardEvent).toHaveBeenCalledWith(
			card,
			'waitingEnd.Actor.tessa.grab.3',
			expect.objectContaining({
				kind: 'escape',
				action: expect.objectContaining({ kind: 'escapeRuling', state: 'failed' }),
			}),
		);
	});

	it('with no DC, a result no longer known turns the waiting line back into the ruling line', async () => {
		card.flags[SYSTEM_ID].escapeRoll = { ...link, noDc: true };
		card.flags[SYSTEM_ID].events = [waitingLine()];

		await followEscape({ messageId: 's1', outcome: 'unknown' });

		expect(replaceCardEvent).toHaveBeenCalledWith(
			card,
			'waitingEnd.Actor.tessa.grab.3',
			expect.objectContaining({
				action: expect.objectContaining({ kind: 'escapeRuling', state: 'waiting' }),
			}),
		);
	});
});

describe('escapeOnEnd', () => {
	it('ends the effect on the roll card in place of the waiting line, with its damage', async () => {
		const rules = [{ formula: '1d6', damageType: 'fire' }];
		escapeDamageRulesOf.mockReturnValueOnce(rules);

		expect(await escapeOnEnd('s1', link, { key: 'Escaped' }, { eventId: 'w', at: 3 })).toBe(true);

		expect(endEffects).toHaveBeenCalledWith([grappled], {
			heading: { key: 'NIMBLE.escape.note', data: { effect: 'Grappled' } },
			hostId: 's1',
			reason: { key: 'Escaped' },
			replaces: { eventId: 'w', at: 3 },
		});
		expect(dealEscapeDamage).toHaveBeenCalledWith(
			card,
			tessa,
			expect.objectContaining({ effectId: 'grab' }),
			rules,
		);
	});

	it('a roll card that is gone ends nothing', async () => {
		expect(await escapeOnEnd('gone', link, { key: 'Escaped' })).toBe(false);
		expect(endEffects).not.toHaveBeenCalled();
	});
});
