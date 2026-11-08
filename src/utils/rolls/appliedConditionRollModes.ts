import type { ConditionRollMode } from './conditionRollModes.js';
import { type AppliedTicks, openRollModeTicks } from './rollModeTicks.js';

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

export { appliedConditionRollModes, tickedConditionRollModes };
