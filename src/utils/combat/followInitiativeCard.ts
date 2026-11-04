import { getCombatantBaseActionCurrent } from '#documents/combat/combatantSystem.js';
import type { ResultChange } from '#types/resultChange.d.ts';
import { startingActionsOfCard } from '#utils/rolls/initiativeCard.js';
import { resultTotal } from '#utils/rolls/resultChanges.js';
import { queueCombatantMutationWithFreshDocument } from './queueCombatantMutationWithFreshDocument.js';

/**
 * The current actions when the starting actions change. Unspent actions become
 * what the new number would have given at the roll, with the same pending
 * adjustment in it. After that, the difference goes on what is left.
 */
function actionsAfterChange(input: {
	current: number;
	before: number;
	after: number;
	foldedActionDelta: number;
}): number {
	const { current, before, after, foldedActionDelta } = input;
	const seeded = (starting: number) => Math.max(0, starting + foldedActionDelta);
	if (current === seeded(before)) return seeded(after);
	return Math.max(0, current + after - before);
}

/**
 * Write a change of an Initiative card to the card's own combatant. Runs on the
 * GM's client. A combatant that does not hold the card's total now (its combat
 * is gone, it rolled again, or someone set the number by hand) stays as it is.
 * A pending action adjustment stays pending, for the next refill.
 */
async function followInitiativeCard(input: {
	system: Record<string, unknown>;
	rollSource: string | undefined;
	before: readonly ResultChange[];
	after: readonly ResultChange[];
}): Promise<void> {
	const { system, rollSource, before, after } = input;
	const combat = game.combats?.get(String(system.combatId ?? ''));
	if (!combat || !rollSource) return;
	const roll = JSON.parse(rollSource) as { total?: number; terms?: unknown[] };
	const card = { total: Number(roll.total) || 0, terms: roll.terms ?? [] };

	await queueCombatantMutationWithFreshDocument({
		combat,
		combatantId: system.combatantId as string | null | undefined,
		mutation: async (combatant) => {
			if (combatant.initiative !== resultTotal(card.total, before)) return;
			const updates: Record<string, unknown> = { initiative: resultTotal(card.total, after) };
			if (combatant.type === 'character') {
				updates['system.actions.base.current'] = actionsAfterChange({
					current: getCombatantBaseActionCurrent(combatant),
					before: startingActionsOfCard(card, before),
					after: startingActionsOfCard(card, after),
					foldedActionDelta: Number(system.foldedActionDelta) || 0,
				});
			}
			await combatant.update(updates as never);
		},
	});
}

export { followInitiativeCard };
