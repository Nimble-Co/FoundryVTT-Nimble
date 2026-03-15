import { getActorHpValue, getActorWoundsValueAndMax } from './actorResources.js';

export function isCombatantDead(combatant: Combatant.Implementation | null | undefined): boolean {
	if (!combatant) return false;

	if (combatant.type === 'character') {
		const wounds = getActorWoundsValueAndMax(combatant.actor);
		if (!wounds) return false;

		return wounds.value >= wounds.max;
	}

	const hpValue = getActorHpValue(combatant.actor);
	return combatant.defeated || (typeof hpValue === 'number' && hpValue <= 0);
}
