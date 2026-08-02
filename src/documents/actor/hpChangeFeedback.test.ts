import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NimbleBaseActor } from './base.svelte.js';

interface TokenStub {
	object: { visible: boolean; center: { x: number; y: number } };
	hasDynamicRing?: boolean;
	flashRing?: ReturnType<typeof vi.fn>;
}

function makeToken(): TokenStub {
	return { object: { visible: true, center: { x: 0, y: 0 } } };
}

function makeActor(tokens: TokenStub[], hpValue: number) {
	const actor = new NimbleBaseActor({
		_id: 'actor-1',
		type: 'npc',
		system: { attributes: { hp: { value: hpValue, max: 20, temp: 0 } } },
	} as never);

	Object.assign(actor, {
		isToken: false,
		getActiveTokens: vi.fn().mockReturnValue(tokens),
	});

	return actor;
}

/** Drives `_onUpdate` with a previous-HP snapshot so an HP delta is emitted. */
function triggerHpChange(actor: NimbleBaseActor, previousHp: number) {
	const options = {
		nimble: { previousHp: { value: previousHp, max: 20, temp: 0 } },
	} as never;

	actor._onUpdate({} as never, options, 'user-1');
}

function setCanvas(createScrollingText: ReturnType<typeof vi.fn>) {
	(globalThis as { canvas?: unknown }).canvas = {
		ready: true,
		interface: { createScrollingText },
	};
}

describe('HP change scrolling text', () => {
	let warn: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
	});

	afterEach(() => {
		warn.mockRestore();
		(globalThis as { canvas?: unknown }).canvas = undefined;
	});

	it('emits the signed HP delta over each visible token', () => {
		const createScrollingText = vi.fn().mockResolvedValue(undefined);
		setCanvas(createScrollingText);

		triggerHpChange(makeActor([makeToken(), makeToken()], 12), 20);

		expect(createScrollingText).toHaveBeenCalledTimes(2);
		expect(createScrollingText.mock.calls[0][1]).toBe('-8');
	});

	// A third-party wrapper around `createScrollingText` that throws used to escape
	// `_onUpdate`, aborting the core update dispatch before the `updateActor` hook —
	// which left open sheets, token bars and health-state syncs stale until reload.
	it('does not let a throwing canvas API escape _onUpdate', () => {
		const createScrollingText = vi.fn(() => {
			throw new Error('wrapped by a broken module');
		});
		setCanvas(createScrollingText);

		expect(() => triggerHpChange(makeActor([makeToken()], 12), 20)).not.toThrow();
		expect(warn).toHaveBeenCalled();
	});

	it('still renders feedback on the remaining tokens when one fails', () => {
		const createScrollingText = vi
			.fn()
			.mockImplementationOnce(() => {
				throw new Error('wrapped by a broken module');
			})
			.mockResolvedValue(undefined);
		setCanvas(createScrollingText);

		triggerHpChange(makeActor([makeToken(), makeToken()], 12), 20);

		expect(createScrollingText).toHaveBeenCalledTimes(2);
	});

	it('contains a throwing dynamic ring flash', () => {
		const createScrollingText = vi.fn().mockResolvedValue(undefined);
		setCanvas(createScrollingText);

		const token = makeToken();
		token.hasDynamicRing = true;
		token.flashRing = vi.fn(() => {
			throw new Error('wrapped by a broken module');
		});

		expect(() => triggerHpChange(makeActor([token], 12), 20)).not.toThrow();
		expect(warn).toHaveBeenCalled();
	});

	it('handles a rejected scrolling text promise without an unhandled rejection', async () => {
		const createScrollingText = vi.fn().mockRejectedValue(new Error('rejected downstream'));
		setCanvas(createScrollingText);

		triggerHpChange(makeActor([makeToken()], 12), 20);
		await Promise.resolve();

		expect(warn).toHaveBeenCalled();
	});
});
