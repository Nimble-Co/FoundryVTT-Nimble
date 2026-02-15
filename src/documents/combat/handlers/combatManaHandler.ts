import {
	getCombatManaGrantForCombat,
	getCombatManaGrantMap,
	getCombatManaGrantTotalForInitiative,
	primeActorCombatManaSourceRules,
} from '../../../utils/combatManaRules.js';

interface CombatManaHandlerParams {
	combatId: string | null;
	combatManaUpdates: Promise<unknown>[];
	combatant: Combatant.Implementation;
}

export default async function combatManaHandler({
	combatId,
	combatManaUpdates,
	combatant,
}: CombatManaHandlerParams): Promise<void> {
	const shouldGrantCombatMana =
		combatant.type === 'character' &&
		combatant.initiative === null &&
		combatant.actor?.isOwner &&
		Boolean(combatId);

	if (!shouldGrantCombatMana || !combatant.actor || !combatId) return;

	await primeActorCombatManaSourceRules(combatant.actor);

	const existingGrant = getCombatManaGrantForCombat(combatant.actor, combatId);
	if (existingGrant > 0) return;

	const combatMana = getCombatManaGrantTotalForInitiative(combatant.actor);
	if (combatMana <= 0) return;

	const grants = getCombatManaGrantMap(combatant.actor);
	grants[combatId] = { mana: combatMana };

	combatManaUpdates.push(
		combatant.actor.update({
			'system.resources.mana.baseMax': combatMana,
			'system.resources.mana.current': combatMana,
			'flags.nimble.combatManaGrants': grants,
		} as Record<string, unknown>),
	);
}
