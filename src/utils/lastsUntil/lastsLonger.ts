import { type Moment, momentCount } from '#utils/lastsUntil/momentReached.js';
import type { TimeUnit } from '../../models/activeEffect/nimbleEffectChoices.js';

/** What an estimate reads of one application of a condition. */
export interface Application {
	lastsUntil: readonly Moment[];
	/** Core's duration, for an effect from before Lasts Until. */
	duration?: { value?: number | null; units?: string | null } | null;
	/** World seconds since it was applied; 0 for a new application. */
	elapsedSeconds?: number;
}

export interface EstimateContext {
	roundSeconds: number;
	secondsOf(units: TimeUnit, value: number): number;
}

function turnRounds(moment: Moment): number {
	const { boundary, span } = moment;
	if (span === 'currentRound') return 1;
	if (span === 'nextRound') return boundary === 'start' ? 1 : 2;
	if (boundary === 'start') return momentCount(moment);
	return span === 'currentTurn' ? 0.5 : momentCount(moment) + 0.5;
}

function momentRounds(moment: Moment, elapsed: number, context: EstimateContext): number {
	if (moment.kind === 'turn') return turnRounds(moment);
	if (moment.kind === 'time' && moment.units && moment.value) {
		if (moment.units === 'rounds') return moment.value;
		const left = context.secondsOf(moment.units, moment.value) - elapsed;
		return left / context.roundSeconds;
	}
	return Number.POSITIVE_INFINITY;
}

function coreRounds(duration: Application['duration'], elapsed: number, context: EstimateContext) {
	const value = Number(duration?.value);
	if (!Number.isFinite(value) || value <= 0) return Number.POSITIVE_INFINITY;
	if (duration?.units === 'rounds' || duration?.units === 'turns') return value;
	if (duration?.units === 'seconds') return (value - elapsed) / context.roundSeconds;
	return Number.POSITIVE_INFINITY;
}

/**
 * How long an application lasts, in rounds. The first moment wins,
 * so the shortest moment counts. An event, or no moment at all, has no end.
 */
export function estimateRounds(application: Application, context: EstimateContext): number {
	const elapsed = application.elapsedSeconds ?? 0;
	const rounds = application.lastsUntil.map((moment) => momentRounds(moment, elapsed, context));
	rounds.push(coreRounds(application.duration, elapsed, context));
	return Math.min(...rounds);
}

/** A new application replaces the ones on the creature only when it lasts longer. */
export function newApplicationLastsLonger(
	next: Application,
	current: readonly Application[],
	context: EstimateContext,
): boolean {
	const longest = Math.max(...current.map((each) => estimateRounds(each, context)));
	return estimateRounds(next, context) > longest;
}
