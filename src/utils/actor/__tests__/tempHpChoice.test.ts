import { beforeEach, describe, expect, it, vi } from 'vitest';

// Setup loads these modules before a hoisted mock could apply.
const replaceCardEvent = vi.fn(async () => true);
vi.resetModules();
const cardEvents = await vi.importActual<typeof import('#utils/chat/cardEvents.js')>(
	'#utils/chat/cardEvents.js',
);
vi.doMock('#utils/chat/cardEvents.js', () => ({ ...cardEvents, replaceCardEvent }));
const { chooseTempHp, tempHpChoiceEvent } = await import('../tempHpChoice.js');

function makeHolder() {
	const frost = { id: 'eFrost', system: { tempHp: null as number | null }, update: vi.fn() };
	const older = { id: 'eOld', system: { tempHp: 5 }, update: vi.fn() };
	return {
		uuid: 'Actor.tessa',
		name: 'Tessa',
		isOwner: true,
		effects: [frost, older],
		update: vi.fn(),
		frost,
		older,
	};
}

describe('the temp HP choice', () => {
	let tessa: ReturnType<typeof makeHolder>;
	beforeEach(() => {
		vi.clearAllMocks();
		tessa = makeHolder();
		(globalThis as { fromUuidSync?: unknown }).fromUuidSync = vi.fn((uuid: string) =>
			uuid === 'Actor.tessa'
				? tessa
				: uuid === 'Actor.tessa.ActiveEffect.eFrost'
					? tessa.frost
					: null,
		);
	});

	const line = () =>
		tempHpChoiceEvent(tessa, { temp: 5, amount: 3 }, 'Actor.tessa.ActiveEffect.eFrost', 7);

	it('asks with the amount the creature has and the new amount', () => {
		expect(line()).toMatchObject({
			kind: 'tempHpChoice',
			text: { key: 'NIMBLE.chat.tempHpChoice.ask', data: { name: 'Tessa', had: 5, amount: 3 } },
			action: { had: 5, amount: 3, state: 'waiting' },
		});
	});

	it('Keep changes nothing and says what Tessa chose', async () => {
		const event = line();
		await chooseTempHp({ id: 'm1' }, event, false);

		expect(tessa.update).not.toHaveBeenCalled();
		expect(tessa.frost.update).not.toHaveBeenCalled();
		expect(tessa.older.update).not.toHaveBeenCalled();
		expect(replaceCardEvent).toHaveBeenCalledWith(
			{ id: 'm1' },
			event.id,
			expect.objectContaining({
				text: { key: 'NIMBLE.chat.tempHpChoice.chose', data: { name: 'Tessa', amount: 5 } },
				action: expect.objectContaining({ state: 'kept' }),
			}),
		);
	});

	it('Take sets the new amount, which the effect that gave it now owns', async () => {
		const event = line();
		await chooseTempHp({ id: 'm1' }, event, true);

		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 3 });
		expect(tessa.frost.update).toHaveBeenCalledWith({ 'system.tempHp': 3 });
		expect(tessa.older.update).toHaveBeenCalledWith({ 'system.tempHp': null });
		expect(replaceCardEvent).toHaveBeenCalledWith(
			{ id: 'm1' },
			event.id,
			expect.objectContaining({
				text: { key: 'NIMBLE.chat.tempHpChoice.chose', data: { name: 'Tessa', amount: 3 } },
				action: expect.objectContaining({ state: 'took' }),
			}),
		);
	});

	it('Take with no effect that gave it sets the amount and clears the temp HP of every effect', async () => {
		const event = tempHpChoiceEvent(tessa, { temp: 5, amount: 3 }, null, 7);
		await chooseTempHp({ id: 'm1' }, event, true);

		expect(tessa.update).toHaveBeenCalledWith({ 'system.attributes.hp.temp': 3 });
		expect(tessa.older.update).toHaveBeenCalledWith({ 'system.tempHp': null });
		expect(tessa.frost.update).not.toHaveBeenCalled();
	});

	it('a choice already made is not made again', async () => {
		const event = { ...line(), action: { ...line().action, state: 'kept' } } as never;
		expect(await chooseTempHp({ id: 'm1' }, event, true)).toBe(false);
		expect(tessa.update).not.toHaveBeenCalled();
		expect(replaceCardEvent).not.toHaveBeenCalled();
	});
});
