import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getTestGlobals } from '../../../../tests/helpers.js';

const isActiveGM = vi.fn(() => true);
const askActiveGm = vi.fn(async (..._args: unknown[]) => true as unknown);

async function load() {
	vi.resetModules();
	vi.doMock('#utils/isActiveGM.js', () => ({ isActiveGM }));
	vi.doMock('../../isActiveGM.js', () => ({ isActiveGM }));
	vi.doMock('../../askActiveGm.js', () => ({ askActiveGm }));
	return import('../useItemForFree.js');
}

const free = {
	of: ['uses' as const],
	reason: { key: 'NIMBLE.rules.useItemFree.cardLine', data: { feature: 'Rage' } },
};

function actorWith(
	items: Array<{ id: string; identifier?: string; system?: { identifier?: string } }>,
	isOwner = false,
) {
	return {
		uuid: 'Actor.hero',
		isOwner,
		items,
		activateItem: vi.fn(async (..._args: unknown[]) => ({})),
	};
}

describe('useItemForFree', () => {
	beforeEach(() => {
		isActiveGM.mockReturnValue(true);
		askActiveGm.mockClear();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('on the active GM, uses the item with that identifier with no window, free', async () => {
		const { useItemForFree } = await load();
		const actor = actorWith([
			{ id: 'a', identifier: 'frenzy' },
			{ id: 'b', identifier: 'rage' },
		]);

		expect(await useItemForFree(actor, 'rage', free)).toBe(true);
		expect(actor.activateItem).toHaveBeenCalledWith('b', { fastForward: true, free });
		expect(askActiveGm).not.toHaveBeenCalled();
	});

	it('finds an item by its system identifier when the item has no identifier getter', async () => {
		const { useItemForFree } = await load();
		const actor = actorWith([{ id: 'b', system: { identifier: 'rage' } }]);

		await useItemForFree(actor, 'rage', free);

		expect(actor.activateItem).toHaveBeenCalledWith('b', expect.anything());
	});

	it('uses nothing when the actor has no such item', async () => {
		const { useItemForFree } = await load();
		const actor = actorWith([{ id: 'a', identifier: 'frenzy' }]);

		expect(await useItemForFree(actor, 'rage', free)).toBe(false);
		expect(actor.activateItem).not.toHaveBeenCalled();
	});

	it('on another client, asks the active GM to make the use', async () => {
		const { useItemForFree } = await load();
		isActiveGM.mockReturnValue(false);
		const actor = actorWith([{ id: 'b', identifier: 'rage' }]);

		expect(await useItemForFree(actor, 'rage', free)).toBe(true);
		expect(actor.activateItem).not.toHaveBeenCalled();
		expect(askActiveGm).toHaveBeenCalledWith(expect.stringMatching(/\.useItemForFree$/), {
			actorUuid: 'Actor.hero',
			itemIdentifier: 'rage',
			free,
		});
	});

	it('on the client of a player who owns the actor, makes the use there', async () => {
		const { useItemForFree } = await load();
		isActiveGM.mockReturnValue(false);
		vi.stubGlobal('game', { ...game, user: { id: 'player', isGM: false } });
		const actor = actorWith([{ id: 'b', identifier: 'rage' }], true);

		expect(await useItemForFree(actor, 'rage', free)).toBe(true);
		expect(actor.activateItem).toHaveBeenCalledWith('b', { fastForward: true, free });
		expect(askActiveGm).not.toHaveBeenCalled();
	});

	it('on a GM client that is not the active GM, asks the active GM', async () => {
		const { useItemForFree } = await load();
		isActiveGM.mockReturnValue(false);
		vi.stubGlobal('game', { ...game, user: { id: 'other-gm', isGM: true } });
		const actor = actorWith([{ id: 'b', identifier: 'rage' }], true);

		await useItemForFree(actor, 'rage', free);

		expect(actor.activateItem).not.toHaveBeenCalled();
		expect(askActiveGm).toHaveBeenCalledTimes(1);
	});

	it('registers a query that makes the use on the GM', async () => {
		const { registerUseItemForFreeQuery } = await load();
		const actor = actorWith([{ id: 'b', identifier: 'rage' }]);
		const queries: Record<string, (data: unknown) => Promise<unknown>> = {};
		const globals = getTestGlobals<{ CONFIG: { queries?: unknown }; Hooks: { once: unknown } }>();
		const previousQueries = globals.CONFIG.queries;
		globals.CONFIG.queries = queries;
		const once = vi.fn((_event: string, callback: () => void) => callback());
		vi.stubGlobal('Hooks', { ...(globals.Hooks as object), once });
		vi.stubGlobal('fromUuid', async (uuid: string) => (uuid === 'Actor.hero' ? actor : null));

		registerUseItemForFreeQuery();
		const [name, handler] = Object.entries(queries)[0] ?? [];
		const answer = await handler?.({ actorUuid: 'Actor.hero', itemIdentifier: 'rage', free });
		globals.CONFIG.queries = previousQueries;

		expect(name).toMatch(/\.useItemForFree$/);
		expect(answer).toBe(true);
		expect(actor.activateItem).toHaveBeenCalledWith('b', { fastForward: true, free });
	});
});
