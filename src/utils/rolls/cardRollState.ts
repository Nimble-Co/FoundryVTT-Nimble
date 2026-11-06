import type { ResultChange } from '#types/resultChange.d.ts';
import type { PendingKeep } from '../incomingReactions/incomingReactionEntry.js';
import { resultChangesOf, standingResultChanges } from './resultChanges.js';

interface CardRollSystem {
	pendingKeep?: PendingKeep | null;
	damageApplied?: boolean;
	discardedCritTriggers?: boolean;
	discardedCritTriggersFired?: boolean;
}

function systemOf(system: unknown): CardRollSystem {
	return (system ?? {}) as CardRollSystem;
}

/** The Keep a Result that waits on the card, or null. Nothing that depends on the roll happens until then. */
function pendingKeepOf(system: unknown): PendingKeep | null {
	return systemOf(system).pendingKeep ?? null;
}

/** The target tokens the card's standing no-damage changes cover, with what names each. */
function noDamageTargetsOf(system: unknown): Map<string, ResultChange> {
	const covered = new Map<string, ResultChange>();
	for (const change of standingResultChanges(resultChangesOf(system))) {
		if (change.change === 'noDamage' && change.targetTokenUuid) {
			covered.set(change.targetTokenUuid, change);
		}
	}
	return covered;
}

/**
 * Why a Change a Result line cannot be removed now, as the reason key the
 * card shows, or null when it can. A Keep a Result must come first; a change
 * no click made, or one a new roll took off, has nothing to remove; and no
 * damage stands once the card's damage is applied. Who may remove it is
 * not part of this.
 */
function resultRemovalRefusal(
	system: unknown,
	change: ResultChange,
): 'NIMBLE.chat.incomingReactions.keepFirst' | 'NIMBLE.chat.incomingReactions.useFailed' | null {
	if (pendingKeepOf(system)) return 'NIMBLE.chat.incomingReactions.keepFirst';
	if (change.automatic || change.retired) return 'NIMBLE.chat.incomingReactions.useFailed';
	if (change.change === 'noDamage' && systemOf(system).damageApplied === true) {
		return 'NIMBLE.chat.incomingReactions.useFailed';
	}
	return null;
}

/** A Reroll discarded a crit and kept its triggers, and they have not fired yet. */
function owesCritTriggers(system: unknown): boolean {
	const card = systemOf(system);
	return card.discardedCritTriggers === true && card.discardedCritTriggersFired !== true;
}

export { noDamageTargetsOf, owesCritTriggers, pendingKeepOf, resultRemovalRefusal };
