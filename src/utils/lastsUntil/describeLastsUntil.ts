import type { HeldAppliesTo, HeldUsedUp } from '#types/heldChange.d.ts';
import type { LastsUntilEvent } from '../../models/activeEffect/nimbleEffectChoices.js';
import getDamageTypeLabel from '../damage/getDamageTypeLabel.js';
import { isRoundSpan } from './momentForm.js';
import { type Moment, turnCount } from './momentReached.js';

const WORDS = 'NIMBLE.lastsUntilText';

export type Localize = (key: string) => string;
export type Format = (key: string, data: Record<string, string>) => string;

/** Who a moment talks about, as the reader sees them. */
export type Person = { kind: 'you' } | { kind: 'they' } | { kind: 'named'; name: string };

export interface LastsUntilReader {
	holder: Person;
	source: Person;
}

/** A card that puts the effect on its targets: they hold it, you used the card. */
export const CARD_TARGETS_READER: LastsUntilReader = {
	holder: { kind: 'they' },
	source: { kind: 'you' },
};

/** A card that puts the effect on the one who used it. */
export const CARD_SELF_READER: LastsUntilReader = {
	holder: { kind: 'you' },
	source: { kind: 'you' },
};

/** The sheet of the holder. With no source name, or the holder as source, the source is "you". */
export function holderReader(sourceName: string | null): LastsUntilReader {
	return {
		holder: { kind: 'you' },
		source: sourceName ? { kind: 'named', name: sourceName } : { kind: 'you' },
	};
}

export type CoreDurationUnits = 'seconds' | 'minutes' | 'hours' | 'days' | 'turns' | 'rounds';

const CORE_UNITS: readonly CoreDurationUnits[] = [
	'seconds',
	'minutes',
	'hours',
	'days',
	'turns',
	'rounds',
];

interface HeldRollLike {
	type?: string;
	disabled?: boolean;
	usedUp?: boolean;
	whichRoll?: HeldAppliesTo;
	meleeOnly?: boolean;
	fromSourceOnly?: boolean;
}

/** The attack that uses up an effect's Held Roll rule, if one of its rules is used up. */
export function usedUpOf(system: unknown): HeldUsedUp | null {
	const rules = (system as { rules?: unknown } | null | undefined)?.rules;
	if (!Array.isArray(rules)) return null;
	const rule = (rules as HeldRollLike[]).find(
		(entry) => entry?.type === 'heldRoll' && !entry.disabled && entry.usedUp !== false,
	);
	if (!rule) return null;
	const by = rule.whichRoll ?? 'holderAttacks';
	return {
		by,
		melee: rule.meleeOnly === true,
		fromSource: by === 'attacksOnHolder' && rule.fromSourceOnly === true,
	};
}

export interface DescribeInput {
	moments: readonly Moment[];
	/** A Held Roll rule that the next attack uses up; it reads first. */
	usedUp?: HeldUsedUp | null;
	/** A core duration of an older effect or a rule; it reads after the moments. */
	coreDuration?: Partial<Record<CoreDurationUnits, number | null>> | null;
	/** The effect has an Escape DC. */
	escape?: boolean;
	reader: LastsUntilReader;
	localize: Localize;
	format: Format;
}

function possessive(person: Person, input: DescribeInput): string {
	if (person.kind === 'named') return input.format(`${WORDS}.possessive`, { name: person.name });
	return input.localize(`${WORDS}.${person.kind === 'you' ? 'your' : 'their'}`);
}

function subjectWord(person: Person, input: DescribeInput): string {
	if (person.kind === 'named') return person.name;
	return input.localize(`${WORDS}.${person.kind}`);
}

function verb(event: LastsUntilEvent, person: Person, input: DescribeInput): string {
	const form = person.kind === 'named' ? 'third' : 'base';
	return input.localize(`${WORDS}.event.${event}.${form}`);
}

function objectWord(person: Person, input: DescribeInput): string {
	if (person.kind === 'named') return person.name;
	return input.localize(`${WORDS}.${person.kind === 'you' ? 'you' : 'them'}`);
}

function sameReader(a: Person, b: Person): boolean {
	return a.kind === b.kind && (a.kind !== 'named' || a.name === (b as { name: string }).name);
}

function usedUpPhrase(usedUp: HeldUsedUp, input: DescribeInput): string {
	const { holder, source } = input.reader;
	const attack = input.localize(`${WORDS}.${usedUp.melee ? 'meleeAttack' : 'attack'}`);
	let moment: string;
	if (usedUp.by === 'holderAttacks') {
		moment = input.format(`${WORDS}.nextAttack`, { whose: possessive(holder, input), attack });
	} else if (usedUp.fromSource && !sameReader(source, holder)) {
		moment = input.format(`${WORDS}.nextAttackFrom`, {
			whose: possessive(source, input),
			attack,
			whom: objectWord(holder, input),
		});
	} else {
		moment = input.format(`${WORDS}.nextAttackOn`, { attack, whom: objectWord(holder, input) });
	}
	return input.format(`${WORDS}.until`, { moment });
}

function turnPhrase(moment: Moment, input: DescribeInput): string {
	const boundary = input.localize(`${WORDS}.boundary.${moment.boundary ?? 'end'}`);
	const span = moment.span ?? 'nextTurn';
	if (isRoundSpan(span)) {
		return input.format(`${WORDS}.until`, {
			moment: input.format(`${WORDS}.round`, {
				boundary,
				round: input.localize(`${WORDS}.span.${span}`),
			}),
		});
	}
	const count = turnCount(moment);
	const spanWord =
		count > 1
			? input.localize(`${WORDS}.nextTurnCount.${count}`)
			: input.localize(`${WORDS}.span.${span}`);
	let whose: string;
	if (moment.clock === 'nextHero') whose = input.localize(`${WORDS}.nextHero`);
	else if (moment.clock === 'any') whose = `${input.localize(`${WORDS}.anyTurn`)} ${spanWord}`;
	else {
		const person = moment.clock === 'source' ? input.reader.source : input.reader.holder;
		whose = `${possessive(person, input)} ${spanWord}`;
	}
	return input.format(`${WORDS}.until`, {
		moment: input.format(`${WORDS}.turn`, { boundary, whose }),
	});
}

function timePhrase(moment: Moment, input: DescribeInput): string {
	const amount = amountOf(moment.units ?? 'rounds', moment.value ?? 1, input);
	return input.format(`${WORDS}.for`, { amount });
}

function eventPhrase(moment: Moment, input: DescribeInput): string {
	const event = moment.event ?? 'attack';
	if (event === 'effectEnds') {
		const name = moment.effectName.trim();
		return input.format(`${WORDS}.until`, {
			moment: name
				? input.format(`${WORDS}.effectEnds`, { name })
				: input.localize(`${WORDS}.anotherEffectEnds`),
		});
	}
	if (event === 'combatEnd') {
		return input.format(`${WORDS}.until`, { moment: input.localize(`${WORDS}.combatEnds`) });
	}
	const person = moment.who === 'source' ? input.reader.source : input.reader.holder;
	const types = event === 'takeDamage' ? (moment.damageTypes ?? []) : [];
	const action = types.length
		? input.format(`${WORDS}.typedDamage.${person.kind === 'named' ? 'third' : 'base'}`, {
				types: types
					.map((type) => getDamageTypeLabel(type).toLocaleLowerCase())
					.join(input.localize(`${WORDS}.orWord`)),
			})
		: verb(event, person, input);
	return input.format(`${WORDS}.until`, {
		moment: `${subjectWord(person, input)} ${action}`,
	});
}

function amountOf(units: string, value: number, input: DescribeInput): string {
	return value === 1
		? input.localize(`${WORDS}.units.${units}.one`)
		: input.format(`${WORDS}.units.${units}.many`, { value: String(value) });
}

function corePhrase(input: DescribeInput): string | null {
	const duration = input.coreDuration;
	if (!duration) return null;
	for (const units of CORE_UNITS) {
		const value = duration[units];
		if (typeof value === 'number' && value > 0) {
			return input.format(`${WORDS}.for`, { amount: amountOf(units, value, input) });
		}
	}
	return null;
}

function phraseOf(moment: Moment, input: DescribeInput): string {
	if (moment.kind === 'turn') return turnPhrase(moment, input);
	if (moment.kind === 'time') return timePhrase(moment, input);
	return eventPhrase(moment, input);
}

/**
 * The Lasts Until of an effect as one sentence: "Until the end of their next
 * turn, or until you drop to 0 HP". Empty when nothing ends the effect.
 */
export function describeLastsUntil(input: DescribeInput): string {
	const phrases = [
		...(input.usedUp ? [usedUpPhrase(input.usedUp, input)] : []),
		...input.moments.map((moment) => phraseOf(moment, input)),
	];
	const core = corePhrase(input);
	if (core) phrases.push(core);
	if (!phrases.length && input.escape) {
		phrases.push(
			input.format(`${WORDS}.until`, {
				moment: `${subjectWord(input.reader.holder, input)} ${input.localize(`${WORDS}.escape`)}`,
			}),
		);
	}
	const sentence = phrases.join(input.localize(`${WORDS}.or`));
	return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}
