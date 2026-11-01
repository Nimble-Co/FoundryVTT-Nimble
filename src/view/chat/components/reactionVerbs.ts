import type { ReactionVerb } from '#types/components/IncomingReactionPrompts.d.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';

/** Change This Roll lists the rows of one actor in this order. */
const REACTION_VERBS: readonly ReactionVerb[] = [
	'reroll',
	'change',
	'crit',
	'result',
	'addDamage',
	'interpose',
];

export const REACTION_VERB_ICONS: Record<ReactionVerb, string> = {
	reroll: 'fa-solid fa-rotate-left',
	change: 'fa-solid fa-pen',
	crit: 'fa-solid fa-burst',
	result: 'fa-solid fa-check',
	addDamage: 'fa-solid fa-dice-d6',
	interpose: 'fa-solid fa-shield-heart',
};

export const REACTION_VERB_WORDS: Record<ReactionVerb, string> = {
	reroll: 'NIMBLE.chat.incomingReactions.verbs.reroll',
	change: 'NIMBLE.chat.incomingReactions.verbs.change',
	crit: 'NIMBLE.chat.incomingReactions.verbs.crit',
	result: 'NIMBLE.chat.incomingReactions.verbs.result',
	addDamage: 'NIMBLE.chat.incomingReactions.spendPoolForDamage',
	interpose: 'NIMBLE.chat.incomingReactions.interpose',
};

export function reactionVerb(entry: IncomingReactionEntry): ReactionVerb {
	if (entry.kind === 'reroll') return entry.use ?? 'reroll';
	if (entry.kind === 'spendPoolForDamage') return 'addDamage';
	return 'interpose';
}

export function sortByVerb(entries: IncomingReactionEntry[]): IncomingReactionEntry[] {
	const place = (entry: IncomingReactionEntry) => REACTION_VERBS.indexOf(reactionVerb(entry));
	return [...entries].sort((a, b) => place(a) - place(b));
}
