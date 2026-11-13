import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async () => true);
const endEffects = vi.fn(async () => {});
const undoEndedEffect = vi.fn(async () => true);
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({ endEffects, undoEndedEffect }));
const { escapeRollNote, followEscape } = await import('../escapeFollow.js');

const link = {
	holderUuid: 'Actor.tessa',
	holderName: 'Tessa',
	effectId: 'grab',
	effectName: 'Grappled',
	noDc: false,
};
const grappled = { id: 'grab', name: 'Grappled' };
const effects = new Map<string, unknown>();
const tessa = { uuid: 'Actor.tessa', name: 'Tessa', effects };

const endedLine = (holderUuid = 'Actor.tessa', effectId = 'grab') => ({
	id: `effectEnded.${holderUuid}.${effectId}.9`,
	kind: 'effectEnded',
	text: { key: 'NIMBLE.lastsUntil.chat.ended' },
	action: { kind: 'undoEnd', row: { effectId, holderUuid } },
	at: 9,
});

let card: {
	id: string;
	type: string;
	system: Record<string, unknown>;
	rolls: Array<{ total: number }>;
	flags: Record<string, any>;
};

function setGM(isActiveGM: boolean) {
	(game as { user?: unknown }).user = { isGM: isActiveGM, isActiveGM };
}

beforeEach(() => {
	vi.clearAllMocks();
	effects.clear();
	effects.set('grab', grappled);
	setGM(true);
	card = {
		id: 's1',
		type: 'savingThrow',
		system: { saveKey: 'dexterity', dc: 13 },
		rolls: [{ total: 14 }],
		flags: { [SYSTEM_ID]: { escapeRoll: link } },
	};
	(game as { messages?: unknown }).messages = { get: (id: string) => (id === 's1' ? card : null) };
	(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn((uuid: string) =>
		uuid === 'Actor.tessa' ? tessa : null,
	);
});

describe('escapeRollNote', () => {
	it('names the effect on the roll card of an Escape, and nothing on any other card', () => {
		expect(escapeRollNote(card)).toBe('Escape Grappled');
		expect(escapeRollNote({ flags: {} })).toBeNull();
		expect(escapeRollNote(null)).toBeNull();
	});
});

describe('followEscape', () => {
	it('a pass ends the effect, with the ended line and its cause on the roll card', async () => {
		expect(await followEscape({ messageId: 's1', outcome: 'pass' })).toBe(true);

		expect(endEffects).toHaveBeenCalledWith([grappled], {
			heading: { key: 'NIMBLE.escape.note', data: { effect: 'Grappled' } },
			hostId: 's1',
			reason: {
				key: 'NIMBLE.escape.chat.escaped',
				data: {
					roll: {
						key: 'NIMBLE.escape.save',
						data: { save: { key: 'NIMBLE.effectSheet.escape.saves.dexterity' } },
					},
					total: 14,
					dc: 13,
				},
			},
		});
		const [[, moment]] = endEffects.mock.calls as unknown as [[unknown, { reason: never }]];
		expect(cardEvents.cardEventText(moment.reason)).toBe('Escaped: DEX save 14 against DC 13');
	});

	it('the cause of a pass with no DC has no DC', async () => {
		card.system.dc = null;
		await followEscape({ messageId: 's1', outcome: 'pass' });

		expect(endEffects).toHaveBeenCalledWith(
			[grappled],
			expect.objectContaining({
				reason: expect.objectContaining({
					key: 'NIMBLE.escape.chat.escapedNoDc',
					data: expect.not.objectContaining({ dc: expect.anything() }),
				}),
			}),
		);
	});

	it('a fail after a pass puts the effect back and removes the ended line', async () => {
		card.flags[SYSTEM_ID].events = [endedLine()];
		effects.clear();

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(undoEndedEffect).toHaveBeenCalledWith(endedLine().action.row);
		expect(replaceCardEvent).toHaveBeenCalledWith(card, endedLine().id, null);
		expect(endEffects).not.toHaveBeenCalled();
	});

	it('a fail after an Undo only removes the ended line', async () => {
		card.flags[SYSTEM_ID].events = [endedLine()];

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(undoEndedEffect).not.toHaveBeenCalled();
		expect(replaceCardEvent).toHaveBeenCalledWith(card, endedLine().id, null);
	});

	it('a fail undoes only an end of this effect on this card', async () => {
		card.flags[SYSTEM_ID].events = [endedLine('Actor.other'), endedLine('Actor.tessa', 'other')];

		await followEscape({ messageId: 's1', outcome: 'fail' });

		expect(undoEndedEffect).not.toHaveBeenCalled();
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});

	it('a pass after the card ended the effect ends nothing again', async () => {
		card.flags[SYSTEM_ID].events = [endedLine()];

		await followEscape({ messageId: 's1', outcome: 'pass' });

		expect(endEffects).not.toHaveBeenCalled();
	});

	it('a pass on an effect that is gone does nothing', async () => {
		effects.clear();

		await followEscape({ messageId: 's1', outcome: 'pass' });

		expect(endEffects).not.toHaveBeenCalled();
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});

	it('an unknown result does nothing', async () => {
		await followEscape({ messageId: 's1', outcome: 'unknown' });
		card.flags[SYSTEM_ID].events = [endedLine()];
		await followEscape({ messageId: 's1', outcome: 'unknown' });

		expect(endEffects).not.toHaveBeenCalled();
		expect(undoEndedEffect).not.toHaveBeenCalled();
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});

	it('a card with no link flag is ignored', async () => {
		card.flags = { [SYSTEM_ID]: {} };

		expect(await followEscape({ messageId: 's1', outcome: 'pass' })).toBe(false);
		expect(endEffects).not.toHaveBeenCalled();
	});

	it('a client that is not the active GM does nothing', async () => {
		setGM(false);

		expect(await followEscape({ messageId: 's1', outcome: 'pass' })).toBe(false);
		expect(endEffects).not.toHaveBeenCalled();
	});
});
