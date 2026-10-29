import type { IncomingReactionText } from '#types/components/IncomingReactionPrompts.d.ts';
import type {
	IncomingReactionEntry,
	RerollRecord,
} from '#utils/incomingReactions/incomingReactionEntry.ts';

import localize from '../../../utils/localize.js';
import { getIncomingReactionCost } from './incomingReactionCost.ts';
import { REACTION_VERB_ICONS, REACTION_VERB_WORDS, reactionVerb } from './reactionVerbs.ts';
import { isRerollAgain } from './rerollHistoryLines.ts';

function reactingActor(entry: IncomingReactionEntry) {
	return (fromUuidSync(entry.actorUuid) ?? null) as Actor.Implementation | null;
}

function documentName(uuid: string): string {
	return ((fromUuidSync(uuid) as { name?: string } | null)?.name ?? '').trim();
}

function featureName(entry: IncomingReactionEntry): string {
	return entry.itemUuid ? documentName(entry.itemUuid) : '';
}

function icon(entry: IncomingReactionEntry): string {
	return REACTION_VERB_ICONS[reactionVerb(entry)];
}

/** The short name in a verb's menu, which already says the verb. */
function menuName(entry: IncomingReactionEntry): string {
	return featureName(entry) || entry.label || localize(REACTION_VERB_WORDS[reactionVerb(entry)]);
}

function cost(entry: IncomingReactionEntry): string {
	return getIncomingReactionCost(entry, reactingActor(entry));
}

function usedAttribution(entry: IncomingReactionEntry): string {
	const actorName = reactingActor(entry)?.name ?? '';
	// Spend offers store their outcome as components, so the sentence is
	// built on whichever client renders it rather than the one that spent.
	if (entry.kind === 'spendPoolForDamage') {
		const name = featureName(entry) || entry.label;
		if (typeof entry.usedAmount !== 'number') return name;
		return localize('NIMBLE.chat.incomingReactions.poolSpendNote', {
			label: name,
			amount: String(entry.usedAmount),
			pool: entry.usedPoolLabel ?? '',
			faces: (entry.usedFaces ?? []).join(', '),
		});
	}
	return entry.label
		? localize('NIMBLE.chat.incomingReactions.redirectedToVia', {
				name: actorName,
				label: entry.label,
			})
		: localize('NIMBLE.chat.incomingReactions.redirectedTo', { name: actorName });
}

/** `getRerolls` gives the card's reroll records, which turn a reroll into "Reroll again". */
export function createIncomingReactionText(getRerolls: () => RerollRecord[]): IncomingReactionText {
	function label(entry: IncomingReactionEntry): string {
		if (isRerollAgain(entry, getRerolls())) {
			return localize('NIMBLE.chat.incomingReactions.rerollAgain', {
				feature: featureName(entry) || entry.label,
			});
		}
		if (entry.kind === 'reroll') {
			const key = entry.use === 'change' ? 'changeWith' : 'rerollWith';
			return localize(`NIMBLE.chat.incomingReactions.${key}`, {
				feature: featureName(entry) || entry.label,
			});
		}
		// Prefer the feature's own name over the rule label, which is written
		// for the rules builder, not for players.
		if (entry.kind === 'spendPoolForDamage') {
			const heading = localize('NIMBLE.chat.incomingReactions.spendPoolForDamage');
			const name = featureName(entry);
			return name ? `${heading}: ${name}` : heading;
		}
		const heading = localize('NIMBLE.chat.incomingReactions.interpose');
		return entry.source === 'rule' && entry.label ? `${heading}: ${entry.label}` : heading;
	}

	return {
		reactingActor,
		documentName,
		featureName,
		label,
		menuName,
		icon,
		cost,
		usedAttribution,
	};
}
