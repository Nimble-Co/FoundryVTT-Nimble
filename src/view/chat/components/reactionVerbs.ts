import type { IncomingReactionActorGroup } from '#types/components/IncomingReactionPrompts.d.ts';
import type { ReactionVerb, ReactionVerbGroup } from '#types/components/IncomingReactionVerbs.d.ts';
import type { IncomingReactionEntry } from '#utils/incomingReactions/incomingReactionEntry.ts';

/** The card shows one button per verb, in this order. */
export const REACTION_VERBS: readonly ReactionVerb[] = [
	'reroll',
	'change',
	'addDamage',
	'interpose',
];

export const REACTION_VERB_ICONS: Record<ReactionVerb, string> = {
	reroll: 'fa-solid fa-rotate-left',
	change: 'fa-solid fa-pen',
	addDamage: 'fa-solid fa-dice-d6',
	interpose: 'fa-solid fa-shield-heart',
};

export const REACTION_VERB_WORDS: Record<ReactionVerb, string> = {
	reroll: 'NIMBLE.chat.incomingReactions.verbs.reroll',
	change: 'NIMBLE.chat.incomingReactions.verbs.change',
	addDamage: 'NIMBLE.chat.incomingReactions.spendPoolForDamage',
	interpose: 'NIMBLE.chat.incomingReactions.interpose',
};

export function reactionVerb(entry: IncomingReactionEntry): ReactionVerb {
	if (entry.kind === 'reroll') return entry.use === 'change' ? 'change' : 'reroll';
	if (entry.kind === 'spendPoolForDamage') return 'addDamage';
	return 'interpose';
}

export function groupByVerb(groups: IncomingReactionActorGroup[]): ReactionVerbGroup[] {
	return REACTION_VERBS.flatMap((verb) => {
		const verbGroups = groups
			.map((group) => ({
				...group,
				entries: group.entries.filter((entry) => reactionVerb(entry) === verb),
			}))
			.filter((group) => group.entries.length > 0);
		const count = verbGroups.reduce((total, group) => total + group.entries.length, 0);
		return count > 0 ? [{ verb, groups: verbGroups, count }] : [];
	});
}
