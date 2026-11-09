import type { AppliedTicks, ConditionRollMode } from '#types/conditionRollMode.d.ts';
import { MAX_ROLL_MODE, openRollModeTicks } from './rollModeTicks.js';

/** The lines that are ticked, each with the step it really moved the roll mode. */
function tickedConditionRollModes(
	lines: readonly ConditionRollMode[],
	applied: AppliedTicks,
): ConditionRollMode[] {
	return lines
		.filter((line) => line.key in applied)
		.map((line) => ({ ...line, step: applied[line.key] }))
		.filter((line) => line.step !== 0);
}

/** A roll with no window: every line that starts on goes on the roll mode. */
function appliedConditionRollModes(
	lines: readonly ConditionRollMode[],
	rollMode: number,
): { rollMode: number; lines: ConditionRollMode[] } {
	const opened = openRollModeTicks(
		rollMode,
		lines.map((line) => ({ key: line.key, value: line.step, on: line.on })),
	);
	return { rollMode: opened.mode, lines: tickedConditionRollModes(lines, opened.applied) };
}

/** A window's slider without its condition ticks: they go on the roll as their own sources. */
function rollModeWithoutConditions(rollMode: number, lines: readonly ConditionRollMode[]): number {
	const steps = lines.reduce((sum, line) => sum + line.step, 0);
	return Math.clamp(rollMode - steps, -MAX_ROLL_MODE, MAX_ROLL_MODE);
}

/** Roll mode sources with one more source for each condition step. */
function withConditionSources(
	sources: readonly number[],
	lines: readonly ConditionRollMode[],
): number[] {
	return [...sources, ...lines.map((line) => line.step)];
}

export {
	appliedConditionRollModes,
	rollModeWithoutConditions,
	tickedConditionRollModes,
	withConditionSources,
};
