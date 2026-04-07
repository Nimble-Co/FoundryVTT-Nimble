import { DamageRoll } from '../../dice/DamageRoll.js';

/**
 * A single staged die outcome for the testbench. The caller specifies both the
 * desired integer face value and the face count of the die that will consume
 * the next `randomUniform()` call.
 *
 * Foundry v13's `Die.mapRandomFace(rv)` is `Math.ceil((1 - rv) * faces)`, so
 * to produce `value` we return `(faces - value + 0.5) / faces`. The 0.5 lands
 * the value safely in the middle of its bucket regardless of `value`.
 */
export type StagedValue = { value: number; faces: number };

/**
 * Trace metadata captured by `stageAndRoll` after evaluation. Used by the
 * dice testbench UI to surface what branches the roll exercised.
 */
export type StageAndRollTrace = {
	isCritical: boolean;
	isMiss: boolean;
	total: number;
	stagedValuesRemaining: number;
};

export type StageAndRollResult = {
	roll: DamageRoll;
	trace: StageAndRollTrace;
};

/**
 * Headless orchestration entry point for the Nimble dice testbench.
 *
 * Constructs a `DamageRoll` with the provided formula and options, monkey
 * patches `CONFIG.Dice.randomUniform` to drain the `stagedValues` queue
 * (returning fractional values that map back to the requested integer face
 * results), evaluates the roll, and restores the original `randomUniform`
 * even on error.
 *
 * If the roll consumes more `randomUniform` calls than the queue contains,
 * the original `randomUniform` is invoked for the excess. Any unused staged
 * values are reported via `trace.stagedValuesRemaining`.
 */
export async function stageAndRoll(
	formula: string,
	options: DamageRoll.Options,
	stagedValues: StagedValue[],
): Promise<StageAndRollResult> {
	const queue: StagedValue[] = [...stagedValues];
	const dice = (CONFIG as unknown as { Dice: { randomUniform: () => number } }).Dice;
	const originalRandomUniform = dice.randomUniform;

	dice.randomUniform = () => {
		const next = queue.shift();
		if (next === undefined) return originalRandomUniform();
		// Foundry v13 maps via `Math.ceil((1 - rv) * faces)`, so we return
		// `(faces - value + 0.5) / faces` to land on `value`.
		return (next.faces - next.value + 0.5) / next.faces;
	};

	try {
		const roll = new DamageRoll(formula, {}, options);
		await roll.evaluate();
		return {
			roll,
			trace: {
				isCritical: roll.isCritical ?? false,
				isMiss: roll.isMiss ?? false,
				total: roll.total ?? 0,
				stagedValuesRemaining: queue.length,
			},
		};
	} finally {
		dice.randomUniform = originalRandomUniform;
	}
}
