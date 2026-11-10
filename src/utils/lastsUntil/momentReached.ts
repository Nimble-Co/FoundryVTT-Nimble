import type {
	Clock,
	EventSubject,
	LastsUntilEvent,
	LastsUntilKind,
	TimeUnit,
	TurnBoundary,
	TurnSpan,
} from '../../models/activeEffect/nimbleEffectChoices.js';

export interface Moment {
	kind: LastsUntilKind;
	boundary: TurnBoundary | null;
	clock: Clock | null;
	span: TurnSpan | null;
	value: number | null;
	units: TimeUnit | null;
	who: EventSubject | null;
	event: LastsUntilEvent | null;
	effectName: string;
}

/** Core's `start` of an effect: the turn in progress when it was applied. */
export interface EffectStart {
	combat: string | null;
	combatant: string | null;
	round: number | null;
	turn: number | null;
	time: number;
}

/** One place in the turn order. A minion group takes one turn for all its members. */
export interface TurnSeat {
	combatantId: string;
	groupId: string | null;
	isHero: boolean;
}

export type LastsUntilCheck =
	| { type: 'turnStart' | 'turnEnd'; combatId: string; seat: TurnSeat; round: number }
	| { type: 'roundStart' | 'roundEnd'; combatId: string; round: number }
	| { type: 'combatEnd'; combatId: string }
	| { type: 'worldTime'; worldTime: number }
	| {
			type: 'event';
			event: LastsUntilEvent;
			actor: object | null;
			itemUuid?: string | null;
			effectName?: string | null;
	  };

/** What a moment reads of its effect, resolved when the check runs. */
export interface MomentSubject {
	start: EffectStart;
	/** The seat of `start.combatant`, when it is still in that combat. */
	startSeat: TurnSeat | null;
	holder: object | null;
	source: object | null;
	origin: string | null;
	holderInCombat: boolean;
	isClockTurn(clock: Clock, seat: TurnSeat): boolean;
	/** The effect belongs to this combat: applied in it, or its holder or source fights in it. */
	relatesTo(combatId: string): boolean;
	secondsOf(units: TimeUnit, value: number): number;
}

export function sameSeat(a: TurnSeat | null, b: TurnSeat | null): boolean {
	if (!a || !b) return false;
	if (a.combatantId === b.combatantId) return true;
	return a.groupId !== null && a.groupId === b.groupId;
}

/** The first round the effect counts from. Before round 1 counts as round 1. */
function roundBase(subject: MomentSubject, combatId: string): number {
	const { start } = subject;
	return start.combat === combatId ? Math.max(1, start.round ?? 0) : 1;
}

function turnInProgressAtStart(
	subject: MomentSubject,
	check: { combatId: string; seat: TurnSeat; round: number },
): boolean {
	const { start, startSeat } = subject;
	return start.combat === check.combatId && start.round === check.round
		? sameSeat(startSeat, check.seat)
		: false;
}

function turnMomentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
): boolean {
	if (check.type === 'combatEnd') return subject.relatesTo(check.combatId);
	if (check.type === 'worldTime') return !subject.holderInCombat;
	if (check.type === 'event') return false;

	const { boundary, span, clock } = moment;
	if (span === 'currentRound' || span === 'nextRound') {
		if (check.type !== (boundary === 'start' ? 'roundStart' : 'roundEnd')) return false;
		const base = roundBase(subject, check.combatId);
		const ahead = boundary === 'start' || span === 'nextRound' ? 1 : 0;
		return check.round >= base + ahead;
	}

	if (!clock) return false;
	if (check.type !== (boundary === 'start' ? 'turnStart' : 'turnEnd')) return false;
	if (!subject.isClockTurn(clock, check.seat)) return false;
	if (boundary === 'start' || span === 'currentTurn') return true;
	return !turnInProgressAtStart(subject, check);
}

/** "For N rounds": up to the same place in the turn order N rounds later. */
function roundsReached(rounds: number, subject: MomentSubject, check: LastsUntilCheck): boolean {
	if (check.type === 'combatEnd') return subject.relatesTo(check.combatId);
	if (check.type === 'worldTime') return !subject.holderInCombat;
	if (check.type !== 'turnStart' && check.type !== 'roundStart') return false;

	const { start, startSeat } = subject;
	const countsFromSeat = startSeat !== null && start.combat === check.combatId;
	if (check.type === 'turnStart') {
		return countsFromSeat && sameSeat(startSeat, check.seat)
			? check.round >= (start.round ?? 0) + rounds
			: false;
	}
	return !countsFromSeat && check.round >= roundBase(subject, check.combatId) + rounds;
}

function timeMomentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
): boolean {
	const { units, value } = moment;
	if (!units || !value) return false;
	if (units === 'rounds') return roundsReached(value, subject, check);
	if (check.type !== 'worldTime') return false;
	return check.worldTime >= subject.start.time + subject.secondsOf(units, value);
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
	const left = a?.trim().toLowerCase();
	return !!left && left === b?.trim().toLowerCase();
}

function eventMomentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
): boolean {
	if (moment.event === 'combatEnd') {
		return check.type === 'combatEnd' && subject.relatesTo(check.combatId);
	}
	if (check.type !== 'event' || check.event !== moment.event) return false;

	if (moment.event === 'effectEnds') {
		return check.actor === subject.holder && sameName(check.effectName, moment.effectName);
	}
	if (moment.event === 'useAgain') {
		return !!subject.origin && check.itemUuid === subject.origin;
	}
	const creature = moment.who === 'source' ? subject.source : subject.holder;
	return creature !== null && check.actor === creature;
}

export function momentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
): boolean {
	switch (moment.kind) {
		case 'turn':
			return turnMomentReached(moment, subject, check);
		case 'time':
			return timeMomentReached(moment, subject, check);
		case 'event':
			return eventMomentReached(moment, subject, check);
		default:
			return false;
	}
}

/** The first moment wins: the effect ends when any one of its moments is reached. */
export function anyMomentReached(
	moments: readonly Moment[],
	subject: MomentSubject,
	check: LastsUntilCheck,
): boolean {
	return moments.some((moment) => momentReached(moment, subject, check));
}
