/** Duration of one combat round in seconds. */
export const ROUND_SECONDS = 6;

/** Duration of one combat turn in seconds. */
export const TURN_SECONDS = 6;

export type EffectDurationDetails = {
	label: string;
	sortMs: number | null;
};

/**
 * Formats a raw second count into a compact human-readable label.
 *
 * - Values under 60 s → `"Xs"` (e.g. `"45s"`)
 * - Values under 3600 s → `"Xm"` (e.g. `"10m"`)
 * - Values 3600 s and above → `"Xh"` (e.g. `"2h"`)
 *
 * Negative values are clamped to 0, and fractional seconds are rounded up.
 */
export function compactSecondsLabel(seconds: number): string {
	const boundedSeconds = Math.max(seconds, 0);

	if (boundedSeconds < 60) return `${Math.ceil(boundedSeconds)}s`;
	if (boundedSeconds < 3600) return `${Math.ceil(boundedSeconds / 60)}m`;
	return `${Math.ceil(boundedSeconds / 3600)}h`;
}

/**
 * Derives a display label and sort key (in milliseconds) from an active-effect duration object.
 *
 * Priority order for the label:
 * 1. `remaining` — real-time seconds remaining (e.g. from a running world clock)
 * 2. `turns` — combat turns remaining
 * 3. `rounds` — combat rounds remaining
 * 4. `seconds` — static second count
 * 5. Fallback: `"∞"` with `sortMs: null` (permanent / no duration set)
 *
 * Returns `{ label: "∞", sortMs: null }` when `duration` is `null` or `undefined`.
 */
export function deriveDurationDetails(
	duration:
		| {
				remaining?: number;
				seconds?: number;
				rounds?: number;
				turns?: number;
		  }
		| null
		| undefined,
): EffectDurationDetails {
	if (!duration) {
		return { label: '∞', sortMs: null };
	}

	if (typeof duration.remaining === 'number' && Number.isFinite(duration.remaining)) {
		const remainingMs = Math.max(duration.remaining, 0) * 1000;
		return { label: compactSecondsLabel(duration.remaining), sortMs: remainingMs };
	}

	if (typeof duration.turns === 'number' && Number.isFinite(duration.turns) && duration.turns > 0) {
		return { label: `${Math.ceil(duration.turns)}t`, sortMs: duration.turns * TURN_SECONDS * 1000 };
	}

	if (
		typeof duration.rounds === 'number' &&
		Number.isFinite(duration.rounds) &&
		duration.rounds > 0
	) {
		return {
			label: `${Math.ceil(duration.rounds)}r`,
			sortMs: duration.rounds * ROUND_SECONDS * 1000,
		};
	}

	if (typeof duration.seconds === 'number' && Number.isFinite(duration.seconds)) {
		const secondsMs = Math.max(duration.seconds, 0) * 1000;
		return { label: compactSecondsLabel(duration.seconds), sortMs: secondsMs };
	}

	return { label: '∞', sortMs: null };
}

/**
 * Expands a compact duration label (e.g. `"3r"`, `"2t"`) into a localised prose string
 * suitable for display in tooltips (e.g. `"3 Rounds"`, `"1 Turn"`).
 *
 * Recognised compact formats:
 * - `"<N>r"` → `"N round(s)"` via `NIMBLE.durations.round` / `NIMBLE.durationsPlural.round`
 * - `"<N>t"` → `"N turn(s)"` via `NIMBLE.durations.turn` / `NIMBLE.durationsPlural.turn`
 *
 * Unrecognised labels are returned unchanged.
 *
 * @param durationLabel - The compact label produced by {@link deriveDurationDetails}.
 * @param localize - Translation function (receives a NIMBLE i18n key, returns localised text).
 */
export function expandDurationLabel(
	durationLabel: string,
	localize: (key: string) => string,
): string {
	const roundsMatch = durationLabel.match(/^(\d+)r$/i);
	if (roundsMatch) {
		const count = Number.parseInt(roundsMatch[1], 10);
		const roundLabel =
			count === 1 ? localize('NIMBLE.durations.round') : localize('NIMBLE.durationsPlural.round');
		return `${count} ${roundLabel}`;
	}

	const turnsMatch = durationLabel.match(/^(\d+)t$/i);
	if (turnsMatch) {
		const count = Number.parseInt(turnsMatch[1], 10);
		const turnLabel =
			count === 1 ? localize('NIMBLE.durations.turn') : localize('NIMBLE.durationsPlural.turn');
		return `${count} ${turnLabel}`;
	}

	return durationLabel;
}
