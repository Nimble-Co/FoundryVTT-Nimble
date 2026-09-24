import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	type MovementTriggerCardInput,
	postMovementTriggerCard,
} from './postMovementTriggerCard.js';

type Globals = { ChatMessage: { create?: unknown; getSpeaker?: unknown } };

const g = globalThis as unknown as Globals;
const original = { create: g.ChatMessage.create, getSpeaker: g.ChatMessage.getSpeaker };

const heroToken = { id: 'hero', parent: { id: 's' } };
const actor = {
	id: 'a-hero',
	name: 'Hero',
	type: 'character',
	permission: 3,
	getActiveTokens: vi.fn(() => [{ document: heroToken }] as unknown[]),
};
const item = { uuid: 'Actor.a-hero.Item.i1', name: 'Quick Strike', img: 'icons/strike.webp' };

const create = vi.fn(async (data: unknown) => ({ id: 'm1', ...(data as object) }));
const getSpeaker = vi.fn(({ token }: { token?: typeof heroToken | null }) => ({
	scene: token?.parent.id ?? null,
	token: token?.id ?? null,
	actor: 'a-hero',
	alias: 'Hero',
}));

beforeEach(() => {
	g.ChatMessage.create = create;
	g.ChatMessage.getSpeaker = getSpeaker;
	actor.getActiveTokens.mockReturnValue([{ document: heroToken }]);
});

afterEach(() => {
	g.ChatMessage.create = original.create;
	g.ChatMessage.getSpeaker = original.getSpeaker;
});

function input(over: Partial<MovementTriggerCardInput> = {}): MovementTriggerCardInput {
	return {
		actor: actor as unknown as Actor,
		item,
		payload: 'use',
		message: 'Goblin moved next to Hero.',
		targets: ['Scene.s.Token.gob'],
		moverName: 'Goblin',
		spaces: 3,
		spacesThisTurn: 5,
		...over,
	};
}

describe('postMovementTriggerCard', () => {
	it('writes a movementTrigger card with the trigger data', async () => {
		const message = await postMovementTriggerCard(input());

		expect(message).not.toBeNull();
		expect(create).toHaveBeenCalledTimes(1);
		expect(create.mock.calls[0][0]).toEqual({
			author: 'test-user-id',
			speaker: { scene: 's', token: 'hero', actor: 'a-hero', alias: 'Hero' },
			type: 'movementTrigger',
			system: {
				actorName: 'Hero',
				actorType: 'character',
				image: 'icons/strike.webp',
				permissions: 3,
				rollMode: 0,
				name: 'Quick Strike',
				itemUuid: 'Actor.a-hero.Item.i1',
				payload: 'use',
				message: 'Goblin moved next to Hero.',
				targets: ['Scene.s.Token.gob'],
				moverName: 'Goblin',
				spaces: 3,
				spacesThisTurn: 5,
			},
		});
		expect(getSpeaker).toHaveBeenCalledWith({ actor, token: heroToken });
	});

	it('speaks as the given token instead of the first active token', async () => {
		const otherToken = { id: 'other', parent: { id: 's2' } };
		await postMovementTriggerCard(input({ token: otherToken as unknown as TokenDocument }));

		expect(getSpeaker).toHaveBeenCalledWith({ actor, token: otherToken });
	});

	it('speaks as the actor alone when the given token is null', async () => {
		await postMovementTriggerCard(input({ token: null }));

		expect(getSpeaker).toHaveBeenCalledWith({ actor, token: null });
	});

	it('stores an empty item uuid when the item has none', async () => {
		await postMovementTriggerCard(input({ item: { ...item, uuid: null } }));

		const system = (create.mock.calls[0][0] as { system: Record<string, unknown> }).system;
		expect(system.itemUuid).toBe('');
	});

	it('stores an unknown spacesThisTurn as null', async () => {
		await postMovementTriggerCard(input({ spacesThisTurn: null }));

		const system = (create.mock.calls[0][0] as { system: Record<string, unknown> }).system;
		expect(system.spacesThisTurn).toBeNull();
	});

	it('speaks as the actor alone when it has no active token', async () => {
		actor.getActiveTokens.mockReturnValue([]);
		await postMovementTriggerCard(input({ payload: 'reminder', targets: [] }));

		expect(getSpeaker).toHaveBeenCalledWith({ actor, token: null });
		const system = (create.mock.calls[0][0] as { system: Record<string, unknown> }).system;
		expect(system.payload).toBe('reminder');
		expect(system.targets).toEqual([]);
	});
});
