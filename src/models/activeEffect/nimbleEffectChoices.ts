/** The Active Effect type that every effect the system creates uses. */
export const NIMBLE_EFFECT_TYPE = 'nimble';

/** An older type that worlds can still hold. It loads with the Nimble model until a migration converts it. */
export const LEGACY_CONDITION_EFFECT_TYPE = 'condition';

export const LASTS_UNTIL_KINDS = ['turn', 'time', 'event'] as const;

export const TURN_BOUNDARIES = ['start', 'end'] as const;

export const CLOCKS = ['holder', 'source', 'nextHero', 'any'] as const;

export const TURN_SPANS = ['nextTurn', 'currentTurn', 'currentRound', 'nextRound'] as const;
/** The counts a "2nd next turn" moment can wait for. */
export const NEXT_TURN_COUNTS = [2, 3, 4, 5] as const;

export const TIME_UNITS = ['rounds', 'minutes', 'hours', 'days'] as const;

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
	'inactiveRound',
	'wounded',
	'chargeGained',
	'rest',
	'combatEnd',
	'gain',
	'applyEffect',
	'tempHpGone',
] as const;

/** The saves an Escape can allow. The author picks any set of them. */
export const ESCAPE_SAVES = ['strength', 'dexterity', 'intelligence', 'will'] as const;

/** The skills an Escape can allow, besides its saves, in the order of their names. */
export const ESCAPE_SKILLS = [
	'arcana',
	'examination',
	'finesse',
	'influence',
	'insight',
	'lore',
	'might',
	'naturecraft',
	'perception',
	'stealth',
] as const;

export type LastsUntilKind = (typeof LASTS_UNTIL_KINDS)[number];
export type TurnBoundary = (typeof TURN_BOUNDARIES)[number];
export type Clock = (typeof CLOCKS)[number];
export type TurnSpan = (typeof TURN_SPANS)[number];
export type TimeUnit = (typeof TIME_UNITS)[number];
export type EventSubject = (typeof EVENT_SUBJECTS)[number];
export type LastsUntilEvent = (typeof LASTS_UNTIL_EVENTS)[number];
export type EscapeSave = (typeof ESCAPE_SAVES)[number];
export type EscapeSkill = (typeof ESCAPE_SKILLS)[number];
