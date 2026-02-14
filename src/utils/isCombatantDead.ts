type ActorHpData = {
	system?: {
		attributes?: {
			hp?: {
				value?: number;
			};
		};
	};
};

export function getActorHpValue(actor: Actor.Implementation | null | undefined): number | null {
	if (!actor) return null;

	const hpValue = (actor as unknown as ActorHpData).system?.attributes?.hp?.value;
	if (typeof hpValue !== 'number' || Number.isNaN(hpValue)) return null;

	return hpValue;
}

export function isCombatantDead(combatant: Combatant.Implementation | null | undefined): boolean {
	if (!combatant) return false;

	const hpValue = getActorHpValue(combatant.actor);
	return combatant.defeated || (typeof hpValue === 'number' && hpValue <= 0);
}
