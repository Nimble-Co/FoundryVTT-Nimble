/** The Active Effect type that every effect the system creates uses. */
export const NIMBLE_EFFECT_TYPE = 'nimble';

/** An older type that worlds can still hold. It loads with the Nimble model until a migration converts it. */
export const LEGACY_CONDITION_EFFECT_TYPE = 'condition';

export const LASTS_UNTIL_KINDS = ['turn', 'time', 'event'] as const;

export const TURN_BOUNDARIES = ['start', 'end'] as const;

export const CLOCKS = ['holder', 'source', 'nextHero'] as const;

export const TURN_SPANS = ['nextTurn', 'currentTurn', 'currentRound', 'nextRound'] as const;

export const TIME_UNITS = ['minutes', 'hours', 'days'] as const;

export const EVENT_SUBJECTS = ['holder', 'source'] as const;

export const LASTS_UNTIL_EVENTS = [
	'attack',
	'move',
	'castSpell',
	'takeDamage',
	'healed',
	'zeroHp',
	'die',
	'loseConcentration',
	'useAgain',
	'effectEnds',
	'nextRoll',
	'nextDamage',
	'nextSpell',
	'nextAffliction',
	'inactiveRound',
	'wounded',
	'chargeGained',
	'rest',
	'combatEnd',
] as const;

/** The saves an Escape can allow. The author picks any set of them. */
export const ESCAPE_SAVES = ['strength', 'dexterity', 'intelligence', 'will'] as const;

export type LastsUntilKind = (typeof LASTS_UNTIL_KINDS)[number];
export type TurnBoundary = (typeof TURN_BOUNDARIES)[number];
export type Clock = (typeof CLOCKS)[number];
export type TurnSpan = (typeof TURN_SPANS)[number];
export type TimeUnit = (typeof TIME_UNITS)[number];
export type EventSubject = (typeof EVENT_SUBJECTS)[number];
export type LastsUntilEvent = (typeof LASTS_UNTIL_EVENTS)[number];
export type EscapeSave = (typeof ESCAPE_SAVES)[number];
