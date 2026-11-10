import type { LastsUntilEvent } from '../../models/activeEffect/nimbleEffectChoices.js';
import { isRoundSpan } from './momentForm.js';
import type { Moment } from './momentReached.js';

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

export interface DescribeInput {
	moments: readonly Moment[];
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
	const whose =
		moment.clock === 'nextHero'
			? input.localize(`${WORDS}.nextHero`)
			: `${possessive(moment.clock === 'source' ? input.reader.source : input.reader.holder, input)} ${input.localize(`${WORDS}.span.${span}`)}`;
	return input.format(`${WORDS}.until`, {
		moment: input.format(`${WORDS}.turn`, { boundary, whose }),
	});
}

function timePhrase(moment: Moment, input: DescribeInput): string {
	const value = moment.value ?? 1;
	const units = moment.units ?? 'rounds';
	const amount =
		value === 1
			? input.localize(`${WORDS}.units.${units}.one`)
			: input.format(`${WORDS}.units.${units}.many`, { value: String(value) });
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
	return input.format(`${WORDS}.until`, {
		moment: `${subjectWord(person, input)} ${verb(event, person, input)}`,
	});
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
	const phrases = input.moments.map((moment) => phraseOf(moment, input));
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
