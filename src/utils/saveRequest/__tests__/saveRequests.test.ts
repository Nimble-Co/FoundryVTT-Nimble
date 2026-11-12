import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async () => true);
const addCardEvents = vi.fn(async () => true);
const endEffects = vi.fn(async () => {});
const undoEndedEffect = vi.fn(async () => true);
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({ endEffects, undoEndedEffect }));
const {
	canRollRequest,
	followSaveRequest,
	releaseSaveRequest,
	requestSaves,
	rollRequestedSave,
	saveRequestEvents,
} = await import('../saveRequests.js');

const concentrating = {
	id: 'eConc',
	name: 'Concentration',
	img: 'concentration.svg',
	active: true,
	system: {
		rules: [
			{ id: 'r1', type: 'saveOnEvent', event: 'critReceived', saveType: 'strength', saveDC: '10' },
		],
	},
};
const tessa = {
	uuid: 'Actor.tessa',
	name: 'Tessa',
	effects: Object.assign([concentrating], {
		get: (id: string) => (id === 'eConc' ? concentrating : undefined),
	}),
	getRollData: () => ({}),
	rollSavingThrowToChat: vi.fn(async () => ({ id: 's1' })),
};

describe('save requests', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn(() => tessa);
	});

	it('a crit asks each rule of that event for a save line', () => {
		const [line] = saveRequestEvents(tessa as never, 'critReceived', 5);

		expect(line).toMatchObject({
			kind: 'saveRequest',
			text: {
				key: 'NIMBLE.chat.saveRequest.ask',
				data: { name: 'Tessa', effect: 'Concentration' },
			},
			action: {
				kind: 'saveRequest',
				effectId: 'eConc',
				save: 'strength',
				dc: 10,
				state: 'waiting',
			},
			at: 5,
		});
		expect(saveRequestEvents(tessa as never, 'takeDamage')).toEqual([]);
	});

	it('skips a rule that is off, a prepared rule whose predicate fails, and an inactive effect', () => {
		const rule = { id: 'r1', type: 'saveOnEvent', event: 'critReceived', saveType: 'will' };
		const effectWith = (rules: unknown, active = true) => ({ ...concentrating, active, rules });
		const holderOf = (effect: object) => ({
			...tessa,
			effects: Object.assign([effect], { get: () => effect }),
		});
		const prepared = (test: boolean, dc = 13) =>
			new Map([['r1', { ...rule, dc, test: () => test }]]);

		const off = holderOf({ ...concentrating, system: { rules: [{ ...rule, disabled: true }] } });
		expect(saveRequestEvents(off as never, 'critReceived')).toEqual([]);
		const failing = holderOf(effectWith(prepared(false)));
		expect(saveRequestEvents(failing as never, 'critReceived')).toEqual([]);
		const inactive = holderOf(effectWith(prepared(true), false));
		expect(saveRequestEvents(inactive as never, 'critReceived')).toEqual([]);
		const [line] = saveRequestEvents(holderOf(effectWith(prepared(true))) as never, 'critReceived');
		expect(line?.action).toMatchObject({ save: 'will', dc: 13 });
	});

	it('the lines go on the card that caused the event', async () => {
		await requestSaves({ id: 'm1' }, tessa as never, 'critReceived');
		expect(addCardEvents).toHaveBeenCalledWith({ id: 'm1' }, [
			expect.objectContaining({ kind: 'saveRequest' }),
		]);

		await requestSaves({ id: 'm1' }, tessa as never, 'takeDamage');
		expect(addCardEvents).toHaveBeenCalledTimes(1);
	});

	it('Roll makes a save card that names its line', async () => {
		const [line] = saveRequestEvents(tessa as never, 'critReceived', 5);

		expect(await rollRequestedSave({ id: 'm1' }, line)).toBe(true);
		expect(tessa.rollSavingThrowToChat).toHaveBeenCalledWith('strength', {
			dc: 10,
			cardFlags: { saveRequest: { messageId: 'm1', event: line } },
		});
	});

	it('a line that has its save card is rolled no more', async () => {
		const [line] = saveRequestEvents(tessa as never, 'critReceived', 5);
		const answered = { ...line, action: { ...line.action, saveMessageId: 's1' } };

		expect(canRollRequest(answered.action as never)).toBe(false);
		expect(await rollRequestedSave({ id: 'm1' }, answered as never)).toBe(false);
		expect(tessa.rollSavingThrowToChat).not.toHaveBeenCalled();
	});

	describe('the line follows its save card', () => {
		const [line] = saveRequestEvents(tessa as never, 'critReceived', 5);
		const endedLine = {
			id: 'effectEnded.Actor.tessa.eConc.9',
			kind: 'effectEnded',
			icon: 'x',
			text: { key: 'ended' },
			action: { kind: 'undoEnd', row: { effectId: 'eConc', holderUuid: 'Actor.tessa' } },
			at: 9,
		};
		let card: {
			id: string;
			type: string;
			flags: Record<string, any>;
			update: ReturnType<typeof vi.fn>;
		};
		const saveCard = (id: string, total: number) => ({
			id,
			rolls: [{ total }],
			flags: { [SYSTEM_ID]: { saveRequest: { messageId: 'm1', event: line } } },
		});
		let saves: Record<string, ReturnType<typeof saveCard>>;

		beforeEach(() => {
			card = {
				id: 'm1',
				type: 'feature',
				flags: { [SYSTEM_ID]: { events: [line] } },
				update: vi.fn(async (changes: Record<string, string>) => {
					for (const [path, value] of Object.entries(changes)) {
						foundry.utils.setProperty(card, path, value);
					}
				}),
			};
			saves = { s1: saveCard('s1', 14), s2: saveCard('s2', 6) };
			(game as { messages?: unknown }).messages = {
				get: (id: string) => (id === 'm1' ? card : saves[id]),
			};
		});

		it('a pass keeps the effect, and the line says so', async () => {
			await followSaveRequest({ messageId: 's1', outcome: 'pass' });

			expect(endEffects).not.toHaveBeenCalled();
			expect(replaceCardEvent).toHaveBeenCalledWith(
				card,
				line.id,
				expect.objectContaining({
					text: expect.objectContaining({ key: 'NIMBLE.chat.saveRequest.kept' }),
					action: expect.objectContaining({ state: 'kept', total: 14, saveMessageId: 's1' }),
				}),
			);
		});

		it('a fail ends the effect, with its ended line on the same card', async () => {
			saves.s1.rolls = [{ total: 6 }];
			await followSaveRequest({ messageId: 's1', outcome: 'fail' });

			expect(replaceCardEvent).toHaveBeenCalledWith(card, line.id, null);
			expect(endEffects).toHaveBeenCalledWith(
				[concentrating],
				expect.objectContaining({ hostId: 'm1' }),
			);
		});

		it('a reroll that turns the fail into a pass puts the effect back in place of its ended line', async () => {
			card.flags[SYSTEM_ID].events = [endedLine];
			await followSaveRequest({ messageId: 's1', outcome: 'pass' });

			expect(undoEndedEffect).toHaveBeenCalledWith(endedLine.action.row);
			expect(replaceCardEvent).toHaveBeenCalledWith(
				card,
				endedLine.id,
				expect.objectContaining({
					id: line.id,
					action: expect.objectContaining({ state: 'kept' }),
				}),
			);
		});

		it('a result that is no longer known waits again, with no second Roll', async () => {
			await followSaveRequest({ messageId: 's1', outcome: 'unknown' });

			expect(replaceCardEvent).toHaveBeenCalledWith(
				card,
				line.id,
				expect.objectContaining({
					action: expect.objectContaining({ state: 'waiting', saveMessageId: 's1' }),
				}),
			);
		});

		it('only the first save card rolled for the line counts', async () => {
			await followSaveRequest({ messageId: 's1', outcome: 'pass' });
			await followSaveRequest({ messageId: 's2', outcome: 'fail' });

			expect(replaceCardEvent).toHaveBeenCalledTimes(1);
			expect(endEffects).not.toHaveBeenCalled();
		});

		it('a card with no line link is not a save request', async () => {
			saves.s1.flags = { [SYSTEM_ID]: {} } as never;
			expect(await followSaveRequest({ messageId: 's1', outcome: 'fail' })).toBe(false);
			expect(card.update).not.toHaveBeenCalled();
			expect(replaceCardEvent).not.toHaveBeenCalled();
		});

		it('a reroll that fails again changes nothing', async () => {
			card.flags[SYSTEM_ID].events = [endedLine];
			await followSaveRequest({ messageId: 's1', outcome: 'fail' });

			expect(replaceCardEvent).not.toHaveBeenCalled();
			expect(endEffects).not.toHaveBeenCalled();
		});

		describe('when its save card is deleted', () => {
			const waiting = { ...line, action: { ...line.action, saveMessageId: 's1' } };
			const bind = (id: string) => {
				card.flags[SYSTEM_ID].saveRequestRolls = { [line.id.replaceAll('.', '_')]: id };
			};

			it('a line that waits can be rolled again', async () => {
				card.flags[SYSTEM_ID].events = [waiting];
				bind('s1');

				expect(await releaseSaveRequest(saves.s1)).toBe(true);
				expect(replaceCardEvent).toHaveBeenCalledWith(card, line.id, {
					...line,
					action: line.action,
				});
			});

			it('a line with a result keeps it, and another card frees nothing', async () => {
				card.flags[SYSTEM_ID].events = [
					{ ...waiting, action: { ...waiting.action, state: 'kept' } },
				];
				bind('s1');
				expect(await releaseSaveRequest(saves.s1)).toBe(false);

				card.flags[SYSTEM_ID].events = [waiting];
				expect(await releaseSaveRequest(saves.s2)).toBe(false);
				expect(replaceCardEvent).not.toHaveBeenCalled();
			});
		});
	});
});
