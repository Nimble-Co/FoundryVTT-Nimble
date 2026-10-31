import type { PickableDie } from '../../src/dice/oneDieReroll.ts';
import type {
	DieOutcome,
	IncomingReactionEntry,
} from '#utils/incomingReactions/incomingReactionEntry.ts';
import type {
	IncomingReactionActorGroup,
	IncomingReactionPicking,
	IncomingReactionText,
} from './IncomingReactionPrompts.d.ts';

/** The kinds of use the card gives one button each. */
export type ReactionVerb = 'reroll' | 'change' | 'crit' | 'addDamage' | 'interpose';

export interface ReactionVerbGroup {
	verb: ReactionVerb;
	/** The actors that give this verb, each with only its entries for it. */
	groups: IncomingReactionActorGroup[];
	count: number;
}

export interface IncomingReactionVerbsProps {
	groups: IncomingReactionActorGroup[];
	/** The reroll whose die picker shows under the buttons. */
	picking: IncomingReactionPicking | null;
	busy: boolean;
	/** The card outcome, shown on the Primary Die in the die picker. */
	primaryOutcome: DieOutcome;
	text: IncomingReactionText;
	onuse: (entry: IncomingReactionEntry) => void;
	onpick: (die: PickableDie) => void;
	onvalue: (value: number) => void;
	/** Closes the die picker; returns the id of the entry it was open for. */
	oncancel: () => string | null;
}
