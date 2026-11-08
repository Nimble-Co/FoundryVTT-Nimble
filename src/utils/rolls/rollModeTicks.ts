/** A tick in a roll window that moves the Roll Mode slider by its value. */
interface RollModeTick {
	key: string;
	value: number;
	/** Ticked when the window opens. */
	on?: boolean;
}

/**
 * Per ticked key, what the tick really moved the slider. The ends of the
 * slider can take part of a value, and an untick gives back only what the tick took.
 */
type AppliedTicks = Record<string, number>;

const MAX_ROLL_MODE = 6;

function tickRollMode(
	mode: number,
	applied: AppliedTicks,
	tick: RollModeTick,
	checked: boolean,
): { mode: number; applied: AppliedTicks } {
	const next = { ...applied };
	if (checked) {
		if (tick.key in next) return { mode, applied };
		const moved = Math.clamp(mode + tick.value, -MAX_ROLL_MODE, MAX_ROLL_MODE);
		next[tick.key] = moved - mode;
		return { mode: moved, applied: next };
	}
	if (!(tick.key in next)) return { mode, applied };
	const back = Math.clamp(mode - next[tick.key], -MAX_ROLL_MODE, MAX_ROLL_MODE);
	delete next[tick.key];
	return { mode: back, applied: next };
}

/** The slider and the ticks as the window opens: every tick that starts on is applied. */
function openRollModeTicks(
	mode: number,
	ticks: readonly RollModeTick[],
): { mode: number; applied: AppliedTicks } {
	let state = { mode: Math.clamp(mode, -MAX_ROLL_MODE, MAX_ROLL_MODE), applied: {} };
	for (const tick of ticks) {
		if (tick.on) state = tickRollMode(state.mode, state.applied, tick, true);
	}
	return state;
}

export { type AppliedTicks, openRollModeTicks, type RollModeTick, tickRollMode };
