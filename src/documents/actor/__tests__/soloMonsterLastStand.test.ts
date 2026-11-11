import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { NimbleSoloMonster } from '../soloMonster.js';

type Globals = Record<string, any>;
const g = globalThis as Globals;
const game = g.game;

function damageCard(whisper: string[]) {
	return { id: 'attack', whisper, flags: {}, update: vi.fn(async () => undefined) };
}

function lastStandItem(description: string) {
	return { type: 'monsterFeature', system: { subtype: 'lastStand', description } };
}

function boss(description = '') {
	const monster = new NimbleSoloMonster(
		{
			_id: 'boss',
			name: 'Boss',
			type: 'soloMonster',
			system: { attributes: { hp: { value: 0, max: 100, temp: 0 } } },
		} as never,
		undefined as never,
	);
	return Object.assign(monster, {
		uuid: 'Actor.boss',
		items: description ? [lastStandItem(description)] : [],
	});
}

describe('NimbleSoloMonster.activateLastStandFeature', () => {
	let saved: Record<string, unknown>;
	let create: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		saved = {
			messages: game.messages,
			users: game.users,
			isActiveGM: game.user.isActiveGM,
			styles: g.CONST.CHAT_MESSAGE_STYLES,
			create: g.ChatMessage.create,
			applyMode: g.ChatMessage.applyMode,
			getSpeaker: g.ChatMessage.getSpeaker,
			getWhisperRecipients: g.ChatMessage.getWhisperRecipients,
		};
		game.user.isActiveGM = true;
		game.users = { get: (id: string) => ({ isGM: id === 'gm' }) };
		g.CONST.CHAT_MESSAGE_STYLES = { OTHER: 0 };
		create = vi.fn(async () => ({ id: 'last-stand-card' }));
		g.ChatMessage.create = create;
		g.ChatMessage.applyMode = vi.fn();
		g.ChatMessage.getSpeaker = vi.fn(() => ({ alias: 'Boss' }));
		g.ChatMessage.getWhisperRecipients = vi.fn(() => [{ id: 'gm' }]);
	});

	afterEach(() => {
		game.messages = saved.messages;
		game.users = saved.users;
		game.user.isActiveGM = saved.isActiveGM;
		g.CONST.CHAT_MESSAGE_STYLES = saved.styles;
		g.ChatMessage.create = saved.create;
		g.ChatMessage.applyMode = saved.applyMode;
		g.ChatMessage.getSpeaker = saved.getSpeaker;
		g.ChatMessage.getWhisperRecipients = saved.getWhisperRecipients;
	});

	it('puts a line on a GM-only damage card when the phase has no description', async () => {
		const host = damageCard(['gm']);
		game.messages = { get: () => host };

		await boss().activateLastStandFeature({ hostCardId: 'attack' });

		const [changes] = host.update.mock.calls[0] as unknown as [Record<string, unknown>];
		expect(changes[`flags.${SYSTEM_ID}.events`]).toEqual([
			expect.objectContaining({
				kind: 'healthState',
				text: { key: 'NIMBLE.chat.events.healthState.lastStand', data: { name: 'Boss' } },
			}),
		]);
	});

	it('posts no Last Stand card when the line is on the damage card', async () => {
		game.messages = { get: () => damageCard(['gm']) };

		const posted = await boss().activateLastStandFeature({ hostCardId: 'attack' });

		expect(posted).toBeNull();
		expect(create).not.toHaveBeenCalled();
	});

	it('posts the Last Stand card with its description when the phase has one', async () => {
		const host = damageCard(['gm']);
		game.messages = { get: () => host };

		await boss('<p>The boss roars.</p>').activateLastStandFeature({ hostCardId: 'attack' });

		expect(host.update).not.toHaveBeenCalled();
		const [chatData] = create.mock.calls[0] as unknown as [{ system: { description: string } }];
		expect(chatData.system.description).toBe('<p>The boss roars.</p>');
	});

	it('posts the Last Stand card when the damage card is public', async () => {
		const host = damageCard([]);
		game.messages = { get: () => host };

		await boss().activateLastStandFeature({ hostCardId: 'attack' });

		expect(host.update).not.toHaveBeenCalled();
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('posts the Last Stand card when no damage card caused it', async () => {
		game.messages = { get: () => undefined };

		await boss().activateLastStandFeature();

		expect(create).toHaveBeenCalledTimes(1);
	});
});
