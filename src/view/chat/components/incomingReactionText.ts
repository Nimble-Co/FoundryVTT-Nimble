import type {
	IncomingReactionRow,
	IncomingReactionText,
} from '#types/components/IncomingReactionPrompts.d.ts';
import type { ResultUse } from '#types/resultChange.d.ts';
import type {
	IncomingReactionEntry,
	RerollRecord,
} from '#utils/incomingReactions/incomingReactionEntry.ts';

import localize from '../../../utils/localize.js';
import { getIncomingReactionCost } from './incomingReactionCost.ts';
import { REACTION_VERB_ICONS, REACTION_VERB_WORDS, reactionVerb } from './reactionVerbs.ts';
import { isRerollAgain } from './rerollHistoryLines.ts';
import { resultAmount } from './resultChangeLines.ts';

function reactingActor(entry: IncomingReactionEntry) {
	return (fromUuidSync(entry.actorUuid) ?? null) as Actor.Implementation | null;
}

export function documentName(uuid: string | null | undefined): string {
	if (!uuid) return '';
	return ((fromUuidSync(uuid) as { name?: string } | null)?.name ?? '').trim();
}

function featureName(entry: IncomingReactionEntry): string {
	return entry.itemUuid ? documentName(entry.itemUuid) : '';
}

function icon(entry: IncomingReactionEntry): string {
	return REACTION_VERB_ICONS[reactionVerb(entry)];
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

function resultVerb(use: ResultUse): string {
	if (use.change === 'succeed') return localize('NIMBLE.chat.incomingReactions.verbs.succeed');
	if (use.change === 'noDamage') return localize('NIMBLE.chat.incomingReactions.verbs.noDamage');
	if (use.change === 'countsAsNat20') {
		return localize('NIMBLE.chat.incomingReactions.verbs.countsAsNat20');
	}
	if (use.change === 'setTotal') {
		return localize('NIMBLE.chat.incomingReactions.verbs.setTotal', { value: String(use.value) });
	}
	return localize('NIMBLE.chat.incomingReactions.verbs.add', { amount: resultAmount(use) });
}

/**
 * `getRerolls` gives the card's reroll records, which turn a reroll into "Reroll Again".
 * `resultUseOf` gives what a Change a Result entry does now.
 * `gainOf` gives what a row with no cost of its own shows at the right.
 */
export function createIncomingReactionText(
	getRerolls: () => RerollRecord[],
	resultUseOf: (entry: IncomingReactionEntry) => ResultUse | null,
	gainOf: (entry: IncomingReactionEntry) => string,
): IncomingReactionText {
	function verb(entry: IncomingReactionEntry): string {
		const use = entry.use === 'result' ? resultUseOf(entry) : null;
		if (use) return resultVerb(use);
		if (entry.anotherStat) return localize('NIMBLE.chat.incomingReactions.verbs.anotherStat');
		return localize(
			isRerollAgain(entry, getRerolls())
				? 'NIMBLE.chat.incomingReactions.verbs.rerollAgain'
				: REACTION_VERB_WORDS[reactionVerb(entry)],
		);
	}

	function row(entry: IncomingReactionEntry): IncomingReactionRow {
		const words = verb(entry);
		// The baseline Interpose is no feature's.
		const feature = entry.source === 'baseline' ? '' : featureName(entry) || entry.label;
		const cost = getIncomingReactionCost(entry, reactingActor(entry)) || gainOf(entry);
		const note = (entry.hint ?? '').trim();
		const label = feature
			? localize('NIMBLE.chat.incomingReactions.changeThisRoll.sentence', { verb: words, feature })
			: words;
		const sentence = cost
			? localize('NIMBLE.chat.incomingReactions.rerollWithCost', { label, cost })
			: label;
		return {
			verb: words,
			withFeature: feature
				? localize('NIMBLE.chat.incomingReactions.changeThisRoll.withFeature', { feature })
				: '',
			cost,
			note,
			sentence: note
				? localize('NIMBLE.chat.incomingReactions.withNote', { text: sentence, note })
				: sentence,
		};
	}

	// The feature's own name, not the rule label, which is written for the rules builder.
	function spendLabel(entry: IncomingReactionEntry): string {
		const heading = localize('NIMBLE.chat.incomingReactions.spendPoolForDamage');
		const name = featureName(entry);
		return name ? `${heading}: ${name}` : heading;
	}

	return {
		reactingActor,
		documentName,
		featureName,
		spendLabel,
		row,
		icon,
		usedAttribution,
	};
}
