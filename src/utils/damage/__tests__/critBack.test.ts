import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attackRows, sendCritBack, useCritBack } from '../critBack.js';

const globals = globalThis as unknown as Record<string, any>;
const rule = { type: 'critBack', label: 'Final Takedown', item: { id: 'ft' }, test: () => true };
const hero = { name: 'Rook', rules: [rule] };
const item = { id: 'ft' };
const living = { uuid: 'Actor.a', name: 'Ogre', system: { attributes: { hp: { value: 3 } } } };
const dead = { uuid: 'Actor.b', name: 'Rat', system: { attributes: { hp: { value: 0 } } } };

function card() {
	return { id: 'c', flags: {}, setFlag: vi.fn(async () => undefined) };
}

const send = (over: Record<string, unknown> = {}) =>
	sendCritBack({
		card: card(),
		sourceActor: hero,
		sourceItem: item,
		hurt: [living],
		heroTokenUuid: 'Token.h',
		...over,
	} as never);

describe('crit back', () => {
	let featureEffects: boolean;
	let create: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		featureEffects = true;
		create = vi.fn();
		globals.game.settings = { get: () => featureEffects };
		globals.ChatMessage = Object.assign(globals.ChatMessage ?? {}, {
			create,
			getSpeaker: () => ({}),
			getWhisperRecipients: () => [{ id: 'gm' }],
		});
	});

	afterEach(() => {
		delete globals.game.settings;
		delete globals.canvas;
		delete globals.fromUuidSync;
	});

	it('gives the GM a card for a creature that lives', async () => {
		await send();
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toMatchObject({
			type: 'critBack',
			whisper: ['gm'],
			system: { actorUuid: 'Actor.a', heroTokenUuid: 'Token.h', label: 'Final Takedown' },
		});
	});

	it('gives no card for a creature that died', async () => {
		await send({ hurt: [dead] });
		expect(create).not.toHaveBeenCalled();
	});

	it('gives no card for another item', async () => {
		await send({ sourceItem: { id: 'other' } });
		expect(create).not.toHaveBeenCalled();
	});

	it('gives no card with Feature Effects off', async () => {
		featureEffects = false;
		await send();
		expect(create).not.toHaveBeenCalled();
	});

	it('gives one card when the damage is applied a second time', async () => {
		await send({ card: { flags: { nimble: { critBackSent: true } } } });
		expect(create).not.toHaveBeenCalled();
	});

	it('lists the items of the creature that do damage', () => {
		const creature = {
			items: [
				{ id: 'a', name: 'Club', system: { activation: { effects: [{ type: 'damage' }] } } },
				{ id: 'b', name: 'Roar', system: { activation: { effects: [{ type: 'note' }] } } },
			],
		};
		expect(attackRows(creature as never)).toEqual([{ id: 'a', name: 'Club' }]);
	});

	it('makes the attack free, on the hero, and a crit', async () => {
		const activate = vi.fn();
		const setTargets = vi.fn();
		globals.canvas = { tokens: { setTargets } };
		globals.fromUuidSync = () => ({ id: 'heroToken' });

		await useCritBack({
			creature: { items: [{ id: 'a', activate }] },
			itemId: 'a',
			heroTokenUuid: 'Token.h',
			label: 'Final Takedown',
		} as never);

		expect(setTargets).toHaveBeenCalledWith(['heroToken']);
		expect(activate).toHaveBeenCalledWith(
			expect.objectContaining({ fastForward: true, grantedCrit: 'Final Takedown' }),
		);
	});
});
