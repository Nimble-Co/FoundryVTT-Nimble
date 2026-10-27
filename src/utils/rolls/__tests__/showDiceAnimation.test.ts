import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { showDiceAnimation } from '../showDiceAnimation.js';

const game = globalThis as unknown as { game: { dice3d?: unknown } };
const roll = {} as foundry.dice.Roll.Any;

function throwDice() {
	const land = { resolve: (_: unknown) => {} };
	const showForRoll = vi.fn(() => new Promise((resolve) => (land.resolve = resolve)));
	game.game.dice3d = { showForRoll };
	return { showForRoll, land };
}

async function settled(promise: Promise<void>): Promise<boolean> {
	let done = false;
	void promise.then(() => (done = true));
	await vi.advanceTimersByTimeAsync(0);
	return done;
}

describe('showDiceAnimation', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		delete game.game.dice3d;
	});

	it('waits for the dice to land', async () => {
		const { showForRoll, land } = throwDice();

		const shown = showDiceAnimation(roll);

		expect(showForRoll).toHaveBeenCalledTimes(1);
		expect(await settled(shown)).toBe(false);
		land.resolve(true);
		expect(await settled(shown)).toBe(true);
	});

	it('does not wait for a hidden tab, which holds its dice until it is visible', async () => {
		vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
		const { showForRoll } = throwDice();

		const shown = showDiceAnimation(roll);

		expect(showForRoll).toHaveBeenCalledTimes(1);
		expect(await settled(shown)).toBe(true);
	});

	it('stops waiting when the dice never land', async () => {
		throwDice();

		const shown = showDiceAnimation(roll);

		await vi.advanceTimersByTimeAsync(9_999);
		expect(await settled(shown)).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(await settled(shown)).toBe(true);
	});

	it('does nothing without Dice So Nice', async () => {
		expect(await settled(showDiceAnimation(roll))).toBe(true);
	});
});
