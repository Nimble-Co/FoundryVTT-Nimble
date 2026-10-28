import type { IncomingReactionText } from '#types/components/IncomingReactionPrompts.d.ts';
import type {
	IncomingReactionEntry,
	RerollRecord,
} from '#utils/incomingReactions/incomingReactionEntry.ts';

import localize from '../../../utils/localize.js';
import { getIncomingReactionCost } from './incomingReactionCost.ts';
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
	if (entry.kind === 'reroll') return 'fa-solid fa-rotate-left';
	if (entry.kind === 'spendPoolForDamage') return 'fa-solid fa-dice-d6';
	return 'fa-solid fa-shield-heart';
}

function tooltip(entry: IncomingReactionEntry): string | null {
	if (entry.source !== 'rule' || !entry.itemUuid) return null;
	const item = fromUuidSync(entry.itemUuid) as { name?: string } | null;
	return item?.name ?? null;
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
			return localize('NIMBLE.chat.incomingReactions.rerollAgain');
		}
		if (entry.kind === 'reroll') {
			return localize('NIMBLE.chat.incomingReactions.rerollWith', {
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
		icon,
		tooltip,
		cost,
		usedAttribution,
	};
}
