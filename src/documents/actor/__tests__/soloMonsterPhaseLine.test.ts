import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { phaseLineOnCard } from '../soloMonster.js';

type Globals = Record<string, any>;
const game = (globalThis as Globals).game;

function card(whisper: string[]) {
	return { id: 'attack', whisper, flags: {}, update: vi.fn(async () => undefined) };
}

describe('phaseLineOnCard', () => {
	let saved: Record<string, unknown>;

	beforeEach(() => {
		saved = { messages: game.messages, users: game.users, isActiveGM: game.user.isActiveGM };
		game.user.isActiveGM = true;
		game.users = { get: (id: string) => ({ isGM: id === 'gm' }) };
	});

	afterEach(() => {
		game.messages = saved.messages;
		game.users = saved.users;
		game.user.isActiveGM = saved.isActiveGM;
	});

	it('puts Last Stand on a card that only GMs read', async () => {
		const host = card(['gm']);
		game.messages = { get: () => host };

		expect(await phaseLineOnCard({ uuid: 'Actor.boss', name: 'Boss' }, 'lastStand', 'attack')).toBe(
			true,
		);
		const [changes] = host.update.mock.calls[0] as unknown as [Record<string, any>];
		expect(changes[`flags.${SYSTEM_ID}.events`]).toEqual([
			expect.objectContaining({
				kind: 'healthState',
				text: { key: 'NIMBLE.chat.events.healthState.lastStand', data: { name: 'Boss' } },
			}),
		]);
	});

	it('leaves the phase its own card when the damage card is public or missing', async () => {
		const host = card([]);
		game.messages = { get: () => host };

		expect(await phaseLineOnCard({ name: 'Boss' }, 'bloodied', 'attack')).toBe(false);
		expect(await phaseLineOnCard({ name: 'Boss' }, 'bloodied', null)).toBe(false);
		expect(host.update).not.toHaveBeenCalled();
	});
});
