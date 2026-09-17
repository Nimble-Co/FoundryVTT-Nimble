import { beforeEach, describe, expect, it, vi } from 'vitest';

const fromStatusEffect = vi.fn();
const createEffect = vi.fn();
vi.stubGlobal('ActiveEffect', { implementation: { fromStatusEffect, create: createEffect } });

import { NimbleBaseItem } from './base.svelte.js';

function createCaster() {
	return {
		uuid: 'Actor.caster',
		statuses: new Set<string>(),
		effects: { get: () => undefined, [Symbol.iterator]: () => [].values() },
		toggleStatusEffect: vi.fn(async () => undefined),
	};
}

/** Built on the prototype so the real `_createActivationCard` runs. */
function createItemStub(properties: string[]) {
	return Object.assign(Object.create(NimbleBaseItem.prototype), {
		uuid: 'Item.spell',
		tags: new Set(properties.map((property) => `property:${property}`)),
		actor: createCaster(),
		rules: new Map(),
	});
}

const postedMessage = { id: 'message-1', system: { activation: {} } };

/** Re-declared because the real method is protected. */
type ActivationCardHost = {
	_createActivationCard(
		chatData: unknown,
		rolls: unknown[],
		activation: { effects?: unknown[] } | null,
		hookContext: Record<string, unknown>,
	): Promise<unknown>;
};

async function createActivationCard(
	item: ReturnType<typeof createItemStub>,
	{ rolls = [] as unknown[] } = {},
) {
	return (item as ActivationCardHost)._createActivationCard(
		{ type: 'spell' },
		rolls,
		{ effects: [] },
		{},
	);
}

beforeEach(() => {
	fromStatusEffect
		.mockReset()
		.mockImplementation(async () => ({ id: 'effect-1', updateSource: vi.fn() }));
	createEffect.mockReset().mockImplementation(async (effect: unknown) => effect);
	(CONFIG as { statusEffects?: unknown }).statusEffects = [{ id: 'concentration' }];
	(Hooks.call as ReturnType<typeof vi.fn>).mockReturnValue(true);
	(ChatMessage as unknown as { create: unknown }).create = vi.fn(async () => postedMessage);
	(globalThis as { game?: Record<string, unknown> }).game!.settings = { get: () => true };
});

describe('NimbleBaseItem#_createActivationCard concentration', () => {
	it('puts concentration on the caster when the item carries the property', async () => {
		const item = createItemStub(['concentration']);

		await createActivationCard(item);

		expect(createEffect).toHaveBeenCalledWith(expect.anything(), {
			parent: item.actor,
			keepId: true,
		});
	});

	it('puts nothing on the caster when the item does not carry the property', async () => {
		await createActivationCard(createItemStub(['reach']));

		expect(createEffect).not.toHaveBeenCalled();
	});

	it('applies concentration even when a rule suppresses the card', async () => {
		const item = createItemStub(['concentration']);
		item.rules.set('suppressor', { disabled: false, suppressesActivationCard: () => true });

		const chatCard = await createActivationCard(item);

		expect(chatCard).toBeNull();
		expect(createEffect).toHaveBeenCalledTimes(1);
	});
});
