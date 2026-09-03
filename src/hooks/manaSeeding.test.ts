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
	id: string;
	uuid: string;
	type: string;
	system: { resources: { mana: { current: number; max: number } } };
	update: ReturnType<typeof vi.fn>;
};

let nextActorId = 0;

function createManaActor({
	current = 0,
	max = 0,
	type = 'character',
	id = '',
	uuid = '',
} = {}): MockManaActor {
	nextActorId += 1;
	const actorId = id || `actor-${nextActorId}`;
	return {
		id: actorId,
		uuid: uuid || `Actor.${actorId}`,
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

	it('fills the pool when an actor update makes max mana non-zero for the first time', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 3 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 3 });
	});

	it('leaves a partly spent pool alone when max mana was already non-zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 1, max: 3 });

		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('leaves a fully spent pool alone when max mana was already non-zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 3 });

		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not overwrite a current value that already exists when max first appears', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 2, max: 0 });

		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does nothing while max mana stays at zero', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 0 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not write when the update was initiated by a different user', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 5, userId: 'someone-else' });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('ignores non-character actors', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0, type: 'npc' });

		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	// The character sheet's max mana field writes `baseMax`, so raising it from
	// zero runs the same path a level-up does. Broader than the level-up case
	// the hook was added for, and intended.
	it('fills the pool when max mana is raised from zero on the sheet', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 6 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 6 });
	});

	// A batched update shares one options object across every document: the
	// backend runs the whole pre-hook loop before any post-hook. Each actor has
	// to read back its own previous max, not the last one stashed.
	it("keeps each actor's previous max separate in a batched update", async () => {
		const callbacks = await registerHooks();
		const gainsAPool = createManaActor({ current: 0, max: 0 });
		const alreadyHasOne = createManaActor({ current: 0, max: 4 });
		const options = {};

		callbacks.get('preUpdateActor')?.(gainsAPool, {}, options, 'user-1');
		callbacks.get('preUpdateActor')?.(alreadyHasOne, {}, options, 'user-1');

		gainsAPool.system.resources.mana.max = 5;
		alreadyHasOne.system.resources.mana.max = 7;

		callbacks.get('updateActor')?.(gainsAPool, {}, options, 'user-1');
		callbacks.get('updateActor')?.(alreadyHasOne, {}, options, 'user-1');
		await flushAsync();

		expect(gainsAPool.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 5 });
		expect(alreadyHasOne.update).not.toHaveBeenCalled();
	});

	// An unlinked token's synthetic actor carries the base actor's id, so two of
	// them in one batch would collide on an id-keyed stash. Their uuids differ.
	it('keeps unlinked token actors sharing a base id separate', async () => {
		const callbacks = await registerHooks();
		const gainsAPool = createManaActor({
			current: 0,
			max: 0,
			id: 'base-actor',
			uuid: 'Scene.s1.Token.t1.Actor.base-actor',
		});
		const alreadyHasOne = createManaActor({
			current: 0,
			max: 4,
			id: 'base-actor',
			uuid: 'Scene.s1.Token.t2.Actor.base-actor',
		});
		const options = {};

		callbacks.get('preUpdateActor')?.(gainsAPool, {}, options, 'user-1');
		callbacks.get('preUpdateActor')?.(alreadyHasOne, {}, options, 'user-1');

		gainsAPool.system.resources.mana.max = 5;
		alreadyHasOne.system.resources.mana.max = 7;

		callbacks.get('updateActor')?.(gainsAPool, {}, options, 'user-1');
		callbacks.get('updateActor')?.(alreadyHasOne, {}, options, 'user-1');
		await flushAsync();

		expect(gainsAPool.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 5 });
		expect(alreadyHasOne.update).not.toHaveBeenCalled();
	});

	// Nothing stashed means the pre-hook never ran for this actor, so there is
	// no before-value to compare against and the post-hook must do nothing.
	it('does nothing when the post-hook runs without a stashed previous max', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		actor.system.resources.mana.max = 5;
		callbacks.get('updateActor')?.(actor, {}, {}, 'user-1');
		await flushAsync();

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not re-seed from the write the seed itself performs', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 0, max: 0 });

		await updateActor(callbacks, actor, { newMax: 5 });
		expect(actor.update).toHaveBeenCalledTimes(1);

		actor.system.resources.mana.current = 5;
		await updateActor(callbacks, actor, { newMax: 5 });

		expect(actor.update).toHaveBeenCalledTimes(1);
	});

	it('clamps the current value down when max mana falls away entirely', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 2, max: 2 });

		await updateActor(callbacks, actor, { newMax: 0 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 0 });
	});

	it('clamps the current value down to a max that fell but stayed positive', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 5, max: 5 });

		await updateActor(callbacks, actor, { newMax: 3 });

		expect(actor.update).toHaveBeenCalledWith({ 'system.resources.mana.current': 3 });
	});

	it('leaves a current value that still fits inside a reduced max alone', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 1, max: 5 });

		await updateActor(callbacks, actor, { newMax: 3 });

		expect(actor.update).not.toHaveBeenCalled();
	});

	it('does not re-clamp from the write the clamp itself performs', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 2, max: 2 });

		await updateActor(callbacks, actor, { newMax: 0 });
		expect(actor.update).toHaveBeenCalledTimes(1);

		actor.system.resources.mana.current = 0;
		await updateActor(callbacks, actor, { newMax: 0 });

		expect(actor.update).toHaveBeenCalledTimes(1);
	});

	it('does not clamp when the update was initiated by a different user', async () => {
		const callbacks = await registerHooks();
		const actor = createManaActor({ current: 2, max: 2 });

		await updateActor(callbacks, actor, { newMax: 0, userId: 'someone-else' });

		expect(actor.update).not.toHaveBeenCalled();
	});
});
