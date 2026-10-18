import { beforeEach, describe, expect, it, vi } from 'vitest';

type HookCallback = (...args: unknown[]) => unknown;

interface EffectStub {
	id: string;
	statuses: Set<string>;
	parent: { documentName: string; effects: Map<string, EffectStub> };
	delete: ReturnType<typeof vi.fn>;
}

const CURRENT_USER_ID = 'test-user-id';
const EXPIRED = { duration: { expired: true } };

function captureHooks(): Map<string, HookCallback> {
	const hooks = new Map<string, HookCallback>();
	(globalThis as unknown as { Hooks: { on: ReturnType<typeof vi.fn> } }).Hooks = {
		on: vi.fn((event: string, callback: HookCallback) => {
			hooks.set(event, callback);
			return 1;
		}),
	};
	return hooks;
}

function createEffect(statuses: string[], parentDocumentName = 'Actor'): EffectStub {
	const parent = { documentName: parentDocumentName, effects: new Map<string, EffectStub>() };
	const effect: EffectStub = {
		id: 'effect-1',
		statuses: new Set(statuses),
		parent,
		delete: vi.fn(async () => {
			parent.effects.delete(effect.id);
			return effect;
		}),
	};
	parent.effects.set(effect.id, effect);
	return effect;
}

async function register(): Promise<HookCallback> {
	const hooks = captureHooks();
	const { registerConditionExpiryHooks } = await import('./conditionExpiry.js');
	registerConditionExpiryHooks();
	const onUpdate = hooks.get('updateActiveEffect');
	if (!onUpdate) throw new Error('updateActiveEffect hook was not registered');
	return onUpdate;
}

describe('registerConditionExpiryHooks', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('deletes a condition effect when this user marks its duration expired', async () => {
		const onUpdate = await register();
		const effect = createEffect(['slowed']);

		await onUpdate(effect, EXPIRED, {}, CURRENT_USER_ID);

		expect(effect.delete).toHaveBeenCalledTimes(1);
		expect(effect.parent.effects.has(effect.id)).toBe(false);
	});

	it('leaves an expired effect alone when none of its statuses is a condition', async () => {
		const onUpdate = await register();
		const effect = createEffect(['inspired']);

		await onUpdate(effect, EXPIRED, {}, CURRENT_USER_ID);

		expect(effect.delete).not.toHaveBeenCalled();
	});

	it.each([
		['sets expired to false', { duration: { expired: false } }],
		['changes the duration but not expired', { duration: { value: 2 } }],
		['changes something else', { name: 'Slowed (renamed)' }],
	])('leaves a condition effect alone when the update %s', async (_label, changed) => {
		const onUpdate = await register();
		const effect = createEffect(['slowed']);

		await onUpdate(effect, changed, {}, CURRENT_USER_ID);

		expect(effect.delete).not.toHaveBeenCalled();
	});

	it('leaves the delete to the client that marked the effect expired', async () => {
		const onUpdate = await register();
		const effect = createEffect(['slowed']);

		await onUpdate(effect, EXPIRED, {}, 'another-user-id');

		expect(effect.delete).not.toHaveBeenCalled();
	});

	it('leaves an expired condition effect on an item alone', async () => {
		const onUpdate = await register();
		const effect = createEffect(['slowed'], 'Item');

		await onUpdate(effect, EXPIRED, {}, CURRENT_USER_ID);

		expect(effect.delete).not.toHaveBeenCalled();
	});

	it('skips the delete when the effect is already gone from the actor', async () => {
		const onUpdate = await register();
		const effect = createEffect(['slowed']);
		effect.parent.effects.delete(effect.id);

		await onUpdate(effect, EXPIRED, {}, CURRENT_USER_ID);

		expect(effect.delete).not.toHaveBeenCalled();
	});

	it('contains a failed delete so it does not become an unhandled rejection', async () => {
		const onUpdate = await register();
		const effect = createEffect(['slowed']);
		effect.delete.mockRejectedValueOnce(new Error('ActiveEffect does not exist'));
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

		await expect(onUpdate(effect, EXPIRED, {}, CURRENT_USER_ID)).resolves.toBeUndefined();
		expect(warn).toHaveBeenCalledTimes(1);

		warn.mockRestore();
	});
});
