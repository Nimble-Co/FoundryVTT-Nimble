import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SYSTEM_ID } from '#system';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';

const setPoolFaces = vi.fn(async (..._args: unknown[]) => true);

type DeleteHook = (effect: unknown, options: unknown, userId: string) => void;

function globals() {
	return getTestGlobals<{ game: { user: { id: string } | null }; Hooks: { on: unknown } }>();
}

async function registeredHook(): Promise<DeleteHook> {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ setPoolFaces }));
	const callbacks = createHookCapture(globals().Hooks.on as never);
	const { default: registerToggleEffectEndHooks } = await import('../toggleEffectEnd.js');
	registerToggleEffectEndHooks();
	return callbacks.get('deleteActiveEffect') as DeleteHook;
}

function toggleHolder(rule: Record<string, unknown>) {
	const actor = new Actor({} as never) as unknown as Record<string, unknown>;
	actor.items = {
		get: (id: string) =>
			id === 'rage' ? { id: 'rage', rules: new Map([['0', rule]]) } : undefined,
	};
	return actor;
}

function toggleEffect(parent: unknown, flags: Record<string, string> = {}) {
	const all: Record<string, string> = {
		toggleEffectRuleId: 'rageToggle',
		toggleEffectItemId: 'rage',
		...flags,
	};
	return {
		parent,
		getFlag: (scope: string, key: string) => (scope === SYSTEM_ID ? all[key] : undefined),
	};
}

const rule = { type: 'toggleEffect', id: 'rageToggle', clearPoolsOnEnd: ['fury', ' ', 'focus'] };

describe('registerToggleEffectEndHooks', () => {
	beforeEach(() => {
		setPoolFaces.mockClear();
		globals().game.user = { id: 'user-1' };
	});

	it('registers a deleteActiveEffect hook', async () => {
		expect(await registeredHook()).toBeTypeOf('function');
	});

	it('empties each listed pool once, on the client of the user who deleted the effect', async () => {
		const hook = await registeredHook();
		const actor = toggleHolder(rule);

		hook(toggleEffect(actor), {}, 'user-1');

		await vi.waitFor(() =>
			expect(setPoolFaces.mock.calls).toEqual([
				[actor, 'fury', []],
				[actor, 'focus', []],
			]),
		);
	});

	it('does nothing on the client of another user, with no GM needed', async () => {
		const hook = await registeredHook();

		hook(toggleEffect(toggleHolder(rule)), {}, 'another-user');
		await Promise.resolve();

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('keeps the pools when the effect is replaced by a new copy', async () => {
		const hook = await registeredHook();

		hook(toggleEffect(toggleHolder(rule)), { [CONDITION_REPLACED_OPTION]: true }, 'user-1');
		await Promise.resolve();

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('does nothing for an effect that is not a toggle, or whose item is gone', async () => {
		const hook = await registeredHook();
		const actor = toggleHolder(rule);

		hook({ parent: actor, getFlag: () => undefined }, {}, 'user-1');
		hook(toggleEffect(actor, { toggleEffectItemId: 'gone' }), {}, 'user-1');
		hook(toggleEffect({ documentName: 'Item' }), {}, 'user-1');
		await Promise.resolve();

		expect(setPoolFaces).not.toHaveBeenCalled();
	});
});
