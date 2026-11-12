import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';

// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async () => true);
const addCardEvents = vi.fn(async () => true);
const endEffects = vi.fn(async () => {});
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, addCardEvents, replaceCardEvent }));
vi.doMock('#utils/lastsUntil/endEffects.js', () => ({ endEffects }));
const { requestSaves, resolveSaveRequest, saveRequestEvents } = await import('../saveRequests.js');

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
	rollSavingThrow: vi.fn(),
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

	describe('the result', () => {
		const [line] = saveRequestEvents(tessa as never, 'critReceived', 5);
		const card = { id: 'm1', type: 'feature', flags: { [SYSTEM_ID]: { events: [line] } } };

		beforeEach(() => {
			(game as { messages?: unknown }).messages = { get: () => card };
		});

		it('a pass keeps the effect, and the line says so', async () => {
			await resolveSaveRequest({ messageId: 'm1', eventId: line.id, total: 14, keptD20: 12 });

			expect(endEffects).not.toHaveBeenCalled();
			expect(replaceCardEvent).toHaveBeenCalledWith(
				card,
				line.id,
				expect.objectContaining({
					text: expect.objectContaining({ key: 'NIMBLE.chat.saveRequest.kept' }),
					action: expect.objectContaining({ state: 'kept', total: 14 }),
				}),
			);
		});

		it('a fail ends the effect, with its ended line on the same card', async () => {
			await resolveSaveRequest({ messageId: 'm1', eventId: line.id, total: 6, keptD20: 4 });

			expect(replaceCardEvent).toHaveBeenCalledWith(card, line.id, null);
			expect(endEffects).toHaveBeenCalledWith(
				[concentrating],
				expect.objectContaining({ hostId: 'm1' }),
			);
		});

		it('takes only the first of two results for the same line', async () => {
			const data = { messageId: 'm1', eventId: line.id, total: 6, keptD20: 4 };
			const results = await Promise.all([resolveSaveRequest(data), resolveSaveRequest(data)]);

			expect(results.filter(Boolean)).toHaveLength(1);
			expect(endEffects).toHaveBeenCalledTimes(1);
		});

		it('a natural 1 fails whatever the total', async () => {
			await resolveSaveRequest({ messageId: 'm1', eventId: line.id, total: 15, keptD20: 1 });
			expect(endEffects).toHaveBeenCalled();
		});
	});
});
