import type { SpanChoice } from '#types/lastsUntilForm.js';
import {
	type Clock,
	type EventSubject,
	type LastsUntilEvent,
	NEXT_TURN_COUNTS,
	type TimeUnit,
	TURN_SPANS,
	type TurnBoundary,
	type TurnSpan,
} from '../../models/activeEffect/nimbleEffectChoices.js';
import type { Moment } from './momentReached.js';

/** What the holder does: "or until they attack". */
export const HOLDER_FORM_EVENTS = [
	'attack',
	'move',
	'castSpell',
	'takeDamage',
	'healed',
	'zeroHp',
	'die',
	'gain',
	'applyEffect',
] as const satisfies readonly LastsUntilEvent[];

/** What the user of the item does: "or until you drop to 0 HP". */
export const SOURCE_FORM_EVENTS = [
	'attack',
	'castSpell',
	'zeroHp',
	'die',
	'loseConcentration',
	'useAgain',
	'gain',
	'applyEffect',
] as const satisfies readonly LastsUntilEvent[];

/** The events that name a condition or an effect: "until they gain Prone". */
export function namesAnEffect(event: LastsUntilEvent | null): boolean {
	return event === 'gain' || event === 'applyEffect';
}

/** The "add a moment..." choices. */
export const NEW_MOMENT_KINDS = ['turn', 'time', 'event', 'effectEnds'] as const;
export type NewMomentKind = (typeof NEW_MOMENT_KINDS)[number];

/** The subject select of an event row: they, you, or another effect. */
export type EventRowSubject = EventSubject | 'effect';

const BLANK: Moment = {
	kind: 'turn',
	boundary: null,
	clock: null,
	span: null,
	value: null,
	units: null,
	who: null,
	event: null,
	effectName: '',
	damageTypes: [],
};

export function newMoment(kind: NewMomentKind): Moment {
	switch (kind) {
		case 'turn':
			return { ...BLANK, kind: 'turn', boundary: 'end', clock: 'holder', span: 'nextTurn' };
		case 'time':
			return { ...BLANK, kind: 'time', value: 1, units: 'minutes' };
		case 'event':
			return { ...BLANK, kind: 'event', who: 'holder', event: 'attack' };
		case 'effectEnds':
			return { ...BLANK, kind: 'event', event: 'effectEnds' };
	}
}

export function isRoundSpan(span: TurnSpan | null): boolean {
	return span === 'currentRound' || span === 'nextRound';
}

export function formEventsOf(who: EventSubject | null): readonly LastsUntilEvent[] {
	return who === 'source' ? SOURCE_FORM_EVENTS : HOLDER_FORM_EVENTS;
}

export function eventRowSubject(moment: Moment): EventRowSubject {
	if (moment.event === 'effectEnds') return 'effect';
	return moment.who ?? 'holder';
}

export function withBoundary(moment: Moment, boundary: TurnBoundary): Moment {
	return { ...moment, boundary };
}

/** A round has no Clock; a turn needs one. A new span drops the count of a "2nd next turn". */
export function withSpan(moment: Moment, span: TurnSpan): Moment {
	if (isRoundSpan(span)) return { ...moment, span, clock: null, value: null };
	return { ...moment, span, clock: moment.clock ?? 'holder', value: null };
}

export function spanChoices(clock: Clock | null): SpanChoice[] {
	const counts = clock === 'nextHero' ? [] : NEXT_TURN_COUNTS.map((n) => `nextTurn:${n}` as const);
	return TURN_SPANS.flatMap((span) => (span === 'nextTurn' ? [span, ...counts] : [span]));
}

export function spanChoiceOf(moment: Moment): SpanChoice {
	const span = moment.span ?? 'nextTurn';
	const count = moment.value ?? 1;
	if (span !== 'nextTurn' || count < 2) return span;
	return `nextTurn:${count}` as SpanChoice;
}

/** The word of a turn list entry, under the tab's words: "span.nextTurn" or "nextTurnCount.2". */
export function spanChoiceWord(choice: SpanChoice): string {
	const [span, count] = choice.split(':');
	return count ? `nextTurnCount.${count}` : `span.${span}`;
}

export function withSpanChoice(moment: Moment, choice: SpanChoice): Moment {
	const [span, count] = choice.split(':') as [TurnSpan, string | undefined];
	const next = withSpan(moment, span);
	return count ? { ...next, value: Number(count) } : next;
}

/** The next hero's turn has no count. */
export function withClock(moment: Moment, clock: Clock): Moment {
	return clock === 'nextHero' ? { ...moment, clock, value: null } : { ...moment, clock };
}

export function withValue(moment: Moment, value: number): Moment {
	const whole = Math.floor(value);
	return { ...moment, value: Number.isFinite(whole) && whole >= 1 ? whole : 1 };
}

export function withUnits(moment: Moment, units: TimeUnit): Moment {
	return { ...moment, units };
}

/** A subject keeps the event when it allows it, else it takes its first event. */
export function withSubject(moment: Moment, subject: EventRowSubject): Moment {
	if (subject === 'effect') {
		return { ...moment, who: null, event: 'effectEnds' };
	}
	const events = formEventsOf(subject);
	const event = moment.event && events.includes(moment.event) ? moment.event : events[0];
	return { ...moment, who: subject, event, effectName: '' };
}

export function withEvent(moment: Moment, event: LastsUntilEvent): Moment {
	const damageTypes = event === 'takeDamage' ? (moment.damageTypes ?? []) : [];
	const effectName = namesAnEffect(event) ? moment.effectName : '';
	return { ...moment, event, damageTypes, effectName };
}

/** Turns one damage type of "take damage" on or off. None on is any type. */
export function withDamageType(moment: Moment, type: string): Moment {
	const on = new Set(moment.damageTypes ?? []);
	if (on.has(type)) on.delete(type);
	else on.add(type);
	return { ...moment, damageTypes: [...on] };
}

export function withEffectName(moment: Moment, effectName: string): Moment {
	return { ...moment, effectName: effectName.trim() };
}

export function replaceAt(moments: readonly Moment[], index: number, next: Moment): Moment[] {
	return moments.map((moment, at) => (at === index ? next : moment));
}

export function removeAt(moments: readonly Moment[], index: number): Moment[] {
	return moments.filter((_, at) => at !== index);
}
