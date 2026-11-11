import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const setPoolFaces = vi.fn(async (..._args: unknown[]) => true);

let clearPoolsOfEndedToggle: typeof import('../toggleEffectEnd.js').clearPoolsOfEndedToggle;

beforeAll(async () => {
	vi.resetModules();
	vi.doMock('#utils/dicePool/dicePoolRefill.js', () => ({ setPoolFaces }));
	({ clearPoolsOfEndedToggle } = await import('../toggleEffectEnd.js'));
});

const gameGlobal = globalThis as unknown as { game: { users?: unknown } };
let savedUsers: unknown;

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
		getFlag: (scope: string, key: string) => (scope === 'nimble' ? all[key] : undefined),
	};
}

const rule = { type: 'toggleEffect', id: 'rageToggle', clearPoolsOnEnd: ['fury', ' ', 'focus'] };

describe('clearPoolsOfEndedToggle', () => {
	beforeEach(() => {
		setPoolFaces.mockClear();
		savedUsers = gameGlobal.game.users;
		gameGlobal.game.users = { activeGM: { id: 'test-user-id' } };
	});

	afterEach(() => {
		gameGlobal.game.users = savedUsers;
	});

	it('empties each listed pool once, on the active GM', async () => {
		const actor = toggleHolder(rule);

		await clearPoolsOfEndedToggle(toggleEffect(actor), {});

		expect(setPoolFaces.mock.calls).toEqual([
			[actor, 'fury', []],
			[actor, 'focus', []],
		]);
	});

	it('does nothing on a client that is not the active GM', async () => {
		gameGlobal.game.users = { activeGM: { id: 'another-gm' } };

		await clearPoolsOfEndedToggle(toggleEffect(toggleHolder(rule)), {});

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('keeps the pools when the effect is replaced by a new copy', async () => {
		await clearPoolsOfEndedToggle(toggleEffect(toggleHolder(rule)), {
			nimbleConditionReplaced: true,
		});

		expect(setPoolFaces).not.toHaveBeenCalled();
	});

	it('does nothing for an effect that is not a toggle, or whose item is gone', async () => {
		const actor = toggleHolder(rule);

		await clearPoolsOfEndedToggle({ parent: actor, getFlag: () => undefined }, {});
		await clearPoolsOfEndedToggle(toggleEffect(actor, { toggleEffectItemId: 'gone' }), {});
		await clearPoolsOfEndedToggle(toggleEffect({ documentName: 'Item' }), {});

		expect(setPoolFaces).not.toHaveBeenCalled();
	});
});
