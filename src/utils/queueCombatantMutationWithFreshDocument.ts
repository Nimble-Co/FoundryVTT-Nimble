import { combatantActionMutationQueue } from './combatantActionMutationQueue.js';

type QueueCombatantMutationWithFreshDocumentParams<T> = {
	combat: Combat;
	combatantId: string | null | undefined;
	mutation: (combatant: Combatant.Implementation) => Promise<T>;
};

export async function queueCombatantMutationWithFreshDocument<T>(
	params: QueueCombatantMutationWithFreshDocumentParams<T>,
): Promise<T | undefined> {
	const combatantId = params.combatantId;
	if (!combatantId) return undefined;

	return combatantActionMutationQueue.queue({
		combat: params.combat,
		combatantId,
		mutation: async () => {
			const currentCombatant = params.combat.combatants.get(combatantId);
			if (!currentCombatant) return undefined;
			return params.mutation(currentCombatant);
		},
	});
}
