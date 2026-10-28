import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type RollingModule = typeof import('../rerollRolling.svelte.js');

const D20 = { slot: 'check', faces: 20 };

// The rolling cards live at module scope, so each test starts from a fresh module.
async function loadModule(): Promise<RollingModule> {
	vi.resetModules();
	return import('../rerollRolling.svelte.js');
}

let rolling: RollingModule;

beforeEach(async () => {
	vi.useFakeTimers();
	rolling = await loadModule();
});

afterEach(() => {
	vi.useRealTimers();
});

describe('rerollRolling', () => {
	it('tells which roll of a card is in the air', () => {
		rolling.startRerollRolling('message-1', D20);

		expect(rolling.rollingRerollOf('message-1')).toEqual(D20);
		expect(rolling.rollingRerollOf('message-2')).toBeNull();
		expect(rolling.rollingRerollOf(null)).toBeNull();
	});

	it('lets the new result settle in when the dice land, for a short time only', () => {
		rolling.startRerollRolling('message-1', D20);

		rolling.stopRerollRolling('message-1');

		expect(rolling.rollingRerollOf('message-1')).toBeNull();
		expect(rolling.rerollJustLanded('message-1', 'check')).toBe(true);
		expect(rolling.rerollJustLanded('message-1', 'node-1')).toBe(false);
		vi.advanceTimersByTime(1_000);
		expect(rolling.rerollJustLanded('message-1', 'check')).toBe(false);
	});

	it('shows the old roll again, with no settle, when the dice stop with no new result', () => {
		rolling.startRerollRolling('message-1', D20);

		rolling.stopRerollRolling('message-1', false);

		expect(rolling.rollingRerollOf('message-1')).toBeNull();
		expect(rolling.rerollJustLanded('message-1', 'check')).toBe(false);
	});

	it('stops by itself when the new roll never arrives', () => {
		rolling.startRerollRolling('message-1', D20);

		vi.advanceTimersByTime(14_999);
		expect(rolling.rollingRerollOf('message-1')).toEqual(D20);
		vi.advanceTimersByTime(1);
		expect(rolling.rollingRerollOf('message-1')).toBeNull();
		expect(rolling.rerollJustLanded('message-1', 'check')).toBe(false);
	});

	it('starts the wait again for a second reroll of the same card', () => {
		rolling.startRerollRolling('message-1', D20);
		vi.advanceTimersByTime(10_000);

		rolling.startRerollRolling('message-1', { slot: 'check', faces: 20 });
		vi.advanceTimersByTime(10_000);

		expect(rolling.rollingRerollOf('message-1')).not.toBeNull();
	});

	it('does nothing when a card that is not rolling stops', () => {
		rolling.stopRerollRolling('message-1');

		expect(rolling.rerollJustLanded('message-1', 'check')).toBe(false);
	});

	describe('registerRerollRollingHook', () => {
		function registerAndGetHook() {
			const on = vi.fn();
			(globalThis as unknown as { Hooks: { on: typeof on } }).Hooks.on = on;
			rolling.registerRerollRollingHook();
			rolling.registerRerollRollingHook();
			expect(on).toHaveBeenCalledTimes(1);
			expect(on.mock.calls[0][0]).toBe('updateChatMessage');
			return on.mock.calls[0][1] as (message: { id: string }, changes: object) => void;
		}

		it('lands the dice when the card gets its new roll', () => {
			const onUpdate = registerAndGetHook();
			rolling.startRerollRolling('message-1', D20);

			onUpdate({ id: 'message-1' }, { rolls: [] });

			expect(rolling.rollingRerollOf('message-1')).toBeNull();
			expect(rolling.rerollJustLanded('message-1', 'check')).toBe(true);
		});

		it('keeps the die rolling through an update that does not change the rolls', () => {
			const onUpdate = registerAndGetHook();
			rolling.startRerollRolling('message-1', D20);

			onUpdate({ id: 'message-1' }, { system: {} });

			expect(rolling.rollingRerollOf('message-1')).toEqual(D20);
		});

		it('shows the old roll again when the new one waits for a player to keep it', () => {
			const onUpdate = registerAndGetHook();
			rolling.startRerollRolling('message-1', D20);

			onUpdate({ id: 'message-1' }, { system: { pendingKeep: { entryId: 'entry-1' } } });

			expect(rolling.rollingRerollOf('message-1')).toBeNull();
			expect(rolling.rerollJustLanded('message-1', 'check')).toBe(false);
		});
	});
});
