import type {
	Clock,
	EventSubject,
	LastsUntilEvent,
	TimeUnit,
	TurnBoundary,
	TurnSpan,
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
] as const satisfies readonly LastsUntilEvent[];

/** What the user of the item does: "or until you drop to 0 HP". */
export const SOURCE_FORM_EVENTS = [
	'zeroHp',
	'die',
	'loseConcentration',
	'useAgain',
] as const satisfies readonly LastsUntilEvent[];

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
};

export function newMoment(kind: NewMomentKind): Moment {
	switch (kind) {
		case 'turn':
			return { ...BLANK, kind: 'turn', boundary: 'end', clock: 'holder', span: 'nextTurn' };
		case 'time':
			return { ...BLANK, kind: 'time', value: 1, units: 'rounds' };
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

/** A round has no Clock; a turn needs one. */
export function withSpan(moment: Moment, span: TurnSpan): Moment {
	if (isRoundSpan(span)) return { ...moment, span, clock: null };
	return { ...moment, span, clock: moment.clock ?? 'holder' };
}

export function withClock(moment: Moment, clock: Clock): Moment {
	return { ...moment, clock };
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
	return { ...moment, event };
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
