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
	/** "Take damage" of these types only. Empty or missing: any type. */
	damageTypes?: string[];
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
	| {
			type: 'turnStart' | 'turnEnd';
			combatId: string;
			seat: TurnSeat;
			round: number;
			/** The index in the turn order, when known. A solo monster has more than one turn in a round. */
			turn?: number | null;
	  }
	| { type: 'roundStart' | 'roundEnd'; combatId: string; round: number }
	| { type: 'combatStart'; combatId: string }
	/** `started`: the combat had a round 1. */
	| { type: 'combatEnd'; combatId: string; started: boolean }
	| { type: 'worldTime'; worldTime: number }
	| {
			type: 'event';
			event: LastsUntilEvent;
			actor: object | null;
			itemUuid?: string | null;
			effectName?: string | null;
			/** The types that dealt damage, for "take damage". */
			damageTypes?: readonly string[] | null;
			/** For "gain": the statuses of the new effect, with the statuses they alias. */
			statuses?: readonly string[] | null;
			/** For "gain": the new effect, which its own moments never end. */
			gained?: object | null;
			/** For "its temp HP are gone": the effects whose temp HP are gone. */
			effectIds?: readonly string[] | null;
	  };

/** What a moment reads of its effect, resolved when the check runs. */
export interface MomentSubject {
	start: EffectStart;
	/** The seat of `start.combatant`, when it is still in that combat. */
	startSeat: TurnSeat | null;
	holder: object | null;
	source: object | null;
	origin: string | null;
	/** The id of the effect itself. */
	effectId?: string | null;
	holderInCombat: boolean;
	isClockTurn(clock: Clock, seat: TurnSeat): boolean;
	/** The effect belongs to this combat: applied in it, or its holder or source fights in it. */
	relatesTo(combatId: string): boolean;
	secondsOf(units: TimeUnit, value: number): number;
	/** For each moment, by index: the clock turns or combat ends it has counted. */
	turnsSeen?: readonly number[];
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
	check: { combatId: string; seat: TurnSeat; round: number; turn?: number | null },
): boolean {
	const { start, startSeat } = subject;
	if (start.combat !== check.combatId || start.round !== check.round) return false;
	if (
		typeof check.turn === 'number' &&
		typeof start.turn === 'number' &&
		check.turn !== start.turn
	) {
		return false;
	}
	return sameSeat(startSeat, check.seat);
}

/**
 * How many clock turns a "2nd next turn" moment waits for, or combat ends a "2nd combat ends"
 * moment waits for. 1 for any other moment.
 */
export function momentCount(moment: Moment): number {
	const counts =
		(moment.kind === 'turn' && moment.span === 'nextTurn') ||
		(moment.kind === 'event' && moment.event === 'combatEnd');
	return counts ? Math.max(1, moment.value ?? 1) : 1;
}

/** Its combat ends. A combat that never started ends only the effects applied in it. */
export function combatEndRelates(
	subject: MomentSubject,
	check: { combatId: string; started: boolean },
): boolean {
	if (!check.started && subject.start.combat !== check.combatId) return false;
	return subject.relatesTo(check.combatId);
}

/** A turn of the moment's clock that counts toward it: not the turn in progress at the start. */
function clockTurnCounts(moment: Moment, subject: MomentSubject, check: LastsUntilCheck): boolean {
	const { boundary, span, clock } = moment;
	if (!clock || span === 'currentRound' || span === 'nextRound') return false;
	if (check.type !== (boundary === 'start' ? 'turnStart' : 'turnEnd')) return false;
	if (!subject.isClockTurn(clock, check.seat)) return false;
	if (boundary === 'start' || span === 'currentTurn') return true;
	return !turnInProgressAtStart(subject, check);
}

function countsAt(moment: Moment, subject: MomentSubject, check: LastsUntilCheck): boolean {
	if (moment.kind !== 'event') return clockTurnCounts(moment, subject, check);
	return check.type === 'combatEnd' && combatEndRelates(subject, check);
}

/** The check is one that a counted moment counts, and its count is not yet reached. */
export function countedAt(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
	index: number,
): boolean {
	const count = momentCount(moment);
	if (count < 2 || !countsAt(moment, subject, check)) return false;
	return (subject.turnsSeen?.[index] ?? 0) + 1 < count;
}

function countReached(moment: Moment, subject: MomentSubject, index: number): boolean {
	return (subject.turnsSeen?.[index] ?? 0) + 1 >= momentCount(moment);
}

function turnMomentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
	index: number,
): boolean {
	if (check.type === 'combatEnd') return combatEndRelates(subject, check);
	if (check.type === 'worldTime') return !subject.holderInCombat;
	if (check.type === 'event' || check.type === 'combatStart') return false;

	const { boundary, span } = moment;
	if (span === 'currentRound' || span === 'nextRound') {
		if (check.type !== (boundary === 'start' ? 'roundStart' : 'roundEnd')) return false;
		const base = roundBase(subject, check.combatId);
		const ahead = boundary === 'start' || span === 'nextRound' ? 1 : 0;
		return check.round >= base + ahead;
	}

	if (!clockTurnCounts(moment, subject, check)) return false;
	return countReached(moment, subject, index);
}

/** "For N rounds": up to the same place in the turn order N rounds later. */
function roundsReached(rounds: number, subject: MomentSubject, check: LastsUntilCheck): boolean {
	if (check.type === 'combatEnd') return combatEndRelates(subject, check);
	if (check.type === 'worldTime') return !subject.holderInCombat;
	if (check.type !== 'turnStart' && check.type !== 'roundStart') return false;

	const { start, startSeat } = subject;
	const countsFromSeat = startSeat !== null && start.combat === check.combatId;
	if (check.type === 'turnStart') {
		if (!countsFromSeat || !sameSeat(startSeat, check.seat)) return false;
		const endRound = (start.round ?? 0) + rounds;
		if (check.round !== endRound) return check.round > endRound;
		return !(
			typeof check.turn === 'number' &&
			typeof start.turn === 'number' &&
			check.turn < start.turn
		);
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
	index: number,
): boolean {
	if (moment.event === 'combatEnd') {
		if (check.type !== 'combatEnd' || !combatEndRelates(subject, check)) return false;
		return countReached(moment, subject, index);
	}
	if (check.type !== 'event' || check.event !== moment.event) return false;

	if (moment.event === 'effectEnds') {
		return check.actor === subject.holder && sameName(check.effectName, moment.effectName);
	}
	if (moment.event === 'tempHpGone') {
		if (!subject.effectId || !(check.effectIds ?? []).includes(subject.effectId)) return false;
	}
	if (moment.event === 'useAgain') {
		return !!subject.origin && check.itemUuid === subject.origin;
	}
	if (moment.event === 'gain' || moment.event === 'applyEffect') {
		const wanted = moment.effectName.trim().toLowerCase();
		const gained = sameName(check.effectName, wanted) || (check.statuses ?? []).includes(wanted);
		if (!wanted || !gained) return false;
	}
	if (moment.event === 'takeDamage' && moment.damageTypes?.length) {
		const dealt = check.damageTypes ?? [];
		if (!moment.damageTypes.some((type) => dealt.includes(type))) return false;
	}
	const creature = moment.who === 'source' ? subject.source : subject.holder;
	return creature !== null && check.actor === creature;
}

export function momentReached(
	moment: Moment,
	subject: MomentSubject,
	check: LastsUntilCheck,
	index = 0,
): boolean {
	switch (moment.kind) {
		case 'turn':
			return turnMomentReached(moment, subject, check, index);
		case 'time':
			return timeMomentReached(moment, subject, check);
		case 'event':
			return eventMomentReached(moment, subject, check, index);
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
	return moments.some((moment, index) => momentReached(moment, subject, check, index));
}
