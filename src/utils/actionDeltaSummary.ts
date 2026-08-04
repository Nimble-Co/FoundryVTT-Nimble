import type { ActionDeltaApplication } from '../models/rules/actionDelta.js';

/**
 * One recipient's line on an activation card's action-adjustment summary.
 *
 * The deltas are the adjustment that was REQUESTED, not the amount that
 * ultimately landed: the combatant clamps and allows overflow when the request
 * is written, and the write may be relayed to another client asynchronously.
 * The card is therefore a record of intent, and a recipient's own action pool
 * remains the authority on what they actually have.
 */
interface ActionDeltaSummaryEntry {
	combatantId: string;
	/** Display name of the recipient at the time of the activation. */
	name: string;
	/** Requested change to the recipient's current action pool. */
	currentDelta: number;
	/** Requested change folded in at the start of the recipient's next turn. */
	pendingDelta: number;
}

/**
 * Turns the per-combatant adjustments an activation requested into the summary
 * stamped onto its chat card.
 *
 * Entries that change nothing are dropped, as are recipients whose name cannot
 * be resolved (a combatant removed between the activation and this call), since
 * a line with nothing to point at tells a reader less than no line at all.
 */
export function buildActionDeltaSummary(
	applications: Map<string, ActionDeltaApplication>,
	resolveCombatantName: (combatantId: string) => string | null,
): ActionDeltaSummaryEntry[] {
	const entries: ActionDeltaSummaryEntry[] = [];

	for (const [combatantId, deltas] of applications) {
		const currentDelta = Math.trunc(Number(deltas.currentDelta) || 0);
		const pendingDelta = Math.trunc(Number(deltas.pendingDelta) || 0);
		if (currentDelta === 0 && pendingDelta === 0) continue;

		const name = resolveCombatantName(combatantId);
		if (!name) continue;

		entries.push({ combatantId, name, currentDelta, pendingDelta });
	}

	return entries;
}

export type { ActionDeltaSummaryEntry };
