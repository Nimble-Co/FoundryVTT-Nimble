import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONDITION_REPLACED_OPTION } from '#utils/actor/applyConditionToActor.js';
import { getTestGlobals } from '../../../tests/helpers.js';
import { createHookCapture } from '../../../tests/mocks/combat.js';

const setPoolFaces = vi.fn(async (..._args: unknown[]) => true);
const getPools = vi.fn((_actor: unknown) => [] as unknown[]);

type DeleteHook = (effect: unknown, options: unknown, userId: string) => void;

function globals() {
	return getTestGlobals<{ game: { user: { id: string } | null }; Hooks: { on: unknown } }>();
}

function mockPoolModules(): void {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ setPoolFaces }));
	vi.doMock('#utils/dicePool/dicePoolSync.js', () => ({ getPools }));
}

async function registeredHook(): Promise<DeleteHook> {
	mockPoolModules();
	const callbacks = createHookCapture(globals().Hooks.on as never);
	const { default: register } = await import('../emptyPoolsAtEnd.js');
	register();
	return callbacks.get('deleteActiveEffect') as DeleteHook;
}

function pool(
	id: string,
	identifier: string,
	scope: 'item' | 'actor',
	sourceItemId: string,
	faces = [3],
) {
	return { id, identifier, scope, sourceItemId, label: `${identifier} dice`, faces };
}

const holder = Object.create(Actor.prototype) as Actor;
const origin = Object.assign(Object.create(Item.prototype), {
	id: 'state-item',
	isEmbedded: true,
	actor: holder,
});

function emptyRule(pools: string[], overrides: Record<string, unknown> = {}) {
	return {
		type: 'emptyPoolsAtEnd',
		disabled: false,
		poolIdentifiers: pools,
		appliesTo: () => true,
		...overrides,
	};
}

function endingEffect(rules: unknown[], parent: unknown = holder) {
	return {
		parent,
		origin: 'Actor.a.Item.state-item',
		rules: new Map(rules.map((rule, i) => [String(i), rule])),
	};
}

describe('Empty pools at end', () => {
	beforeEach(() => {
		setPoolFaces.mockClear();
		getPools.mockReset();
		getPools.mockReturnValue([
			pool('fury', 'fury', 'item', 'state-item'),
			pool('fury-other', 'fury', 'item', 'other-item'),
			pool('actor:focus', 'focus', 'actor', 'other-item', []),
			pool('actor:fury', 'fury', 'actor', 'other-item'),
		]);
		globals().game.user = { id: 'user-1' };
		vi.stubGlobal('fromUuidSync', (uuid: string) =>
			uuid === 'Actor.a.Item.state-item' ? origin : null,
		);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('empties the pool of the origin item first, else the pool of the holder', async () => {
		const hook = await registeredHook();

		hook(endingEffect([emptyRule(['fury', 'focus'])]), {}, 'user-1');

		await vi.waitFor(() =>
			expect(setPoolFaces.mock.calls).toEqual([
				[holder, 'fury', []],
				[holder, 'actor:focus', []],
			]),
		);
	});

	it('uses the pool of the holder when the origin item is not on the holder', async () => {
		const hook = await registeredHook();
		vi.stubGlobal('fromUuidSync', () => null);

		hook(endingEffect([emptyRule(['fury'])]), {}, 'user-1');

		await vi.waitFor(() => expect(setPoolFaces.mock.calls).toEqual([[holder, 'actor:fury', []]]));
	});

	it('empties a pool that two rules name only once', async () => {
		const hook = await registeredHook();

		hook(endingEffect([emptyRule(['fury']), emptyRule(['fury'])]), {}, 'user-1');

		await vi.waitFor(() => expect(setPoolFaces).toHaveBeenCalledTimes(1));
	});

	it('does nothing on the client of another user, or when a new copy replaces the effect', async () => {
		const hook = await registeredHook();

		hook(endingEffect([emptyRule(['fury'])]), {}, 'another-user');
		hook(endingEffect([emptyRule(['fury'])]), { [CONDITION_REPLACED_OPTION]: true }, 'user-1');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('does nothing for a disabled rule, a rule whose predicate fails, or another rule type', async () => {
		const hook = await registeredHook();

		hook(endingEffect([emptyRule(['fury'], { disabled: true })]), {}, 'user-1');
		hook(endingEffect([emptyRule(['fury'], { appliesTo: () => false })]), {}, 'user-1');
		hook(endingEffect([{ type: 'tags', tags: ['self:raging'] }]), {}, 'user-1');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('does nothing for an effect that is not on a creature', async () => {
		const hook = await registeredHook();

		hook(endingEffect([emptyRule(['fury'])], { documentName: 'Scene' }), {}, 'user-1');
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(setPoolFaces).not.toHaveBeenCalled();
	});
});
