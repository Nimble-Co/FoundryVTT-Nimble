import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushAsync, getTestGlobals } from '../../tests/helpers.js';
import { createHookCapture } from '../../tests/mocks/combat.js';

type ManaSeedingTestGlobals = {
	game: { user?: { id?: string } };
	Hooks: { on: ReturnType<typeof vi.fn> };
};

function globals() {
	return getTestGlobals<ManaSeedingTestGlobals>();
}

type MockManaActor = {
	type: string;
	system: { resources: { mana: { current: number; max: number } } };
	update: ReturnType<typeof vi.fn>;
};

function createManaActor({ current = 0, max = 0, type = 'character' } = {}): MockManaActor {
	return {
		type,
		system: { resources: { mana: { current, max } } },
		update: vi.fn().mockResolvedValue(undefined),
	};
}

type HookCallbacks = Map<string, (...args: unknown[]) => unknown>;

async function registerHooks(): Promise<HookCallbacks> {
	const callbacks = createHookCapture(globals().Hooks.on);
	const register = (await import('./manaSeeding.js')).default;
	register();
	return callbacks;
}

async function updateClassItem(
	callbacks: HookCallbacks,
	actor: MockManaActor,
	{
		newMax,
		itemType = 'class',
		userId = 'user-1',
	}: { newMax: number; itemType?: string; userId?: string },
): Promise<void> {
	const item = { type: itemType, actor };
	const options = {};
	callbacks.get('preUpdateItem')?.(item, {}, options, userId);
	actor.system.resources.mana.max = newMax;
	callbacks.get('updateItem')?.(item, {}, options, userId);
	await flushAsync();
}

async function updateActor(
	callbacks: HookCallbacks,
	actor: MockManaActor,
	{ newMax, userId = 'user-1' }: { newMax: number; userId?: string },
): Promise<void> {
	const options = {};
	callbacks.get('preUpdateActor')?.(actor, {}, options, userId);
	actor.system.resources.mana.max = newMax;
	callbacks.get('updateActor')?.(actor, {}, options, userId);
	await flushAsync();
}

describe('registerManaSeedingHooks', () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		globals().game.user = { id: 'user-1' };
	});

	it('fills the pool when a class update makes max mana non-zero for the first time', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 5 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 5 });
	});

	it('fills the pool when a class item is added and max mana becomes non-zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		const item = { type: 'class', actor };
		const options = {};
		callbacks.get('preCreateItem')?.(item, {}, options, 'user-1');
		actor.system.resources.mana.max = 4;
		callbacks.get('createItem')?.(item, options, 'user-1');
		await flushAsync();

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 4 });
	});

	it('fills the pool when an actor update makes max mana non-zero for the first time', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 3 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 3 });
	});

	it('leaves a partly spent pool alone when max mana was already non-zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 1, max: 3 });

		await updateClassItem(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('leaves a fully spent pool alone when max mana was already non-zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 3 });

		await updateClassItem(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not overwrite a current value that already exists when max first appears', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 2, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does nothing while max mana stays at zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 0 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not write when the update was initiated by a different user', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 5, userId: 'someone-else' });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('ignores updates to non-class items', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 5, itemType: 'feature' });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('ignores non-character actors', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0, type: 'npc' });

		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not re-seed from the write the seed itself performs', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateClassItem(callbacks, actor, { newMax: 5 });
		expect(actor.update).toHaveBeenCalledTimes(1);

		actor.system.resources.mana.current = 5;
		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).toHaveBeenCalledTimes(1);
	});
});
