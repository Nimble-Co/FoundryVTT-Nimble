import type { ActorHpData } from '#types/combat.js';

export function getActorHpValue(actor: Actor.Implementation | null | undefined): number | null {
	if (!actor) return null;

	const hpValue = (actor as unknown as ActorHpData).system?.attributes?.hp?.value;
	if (typeof hpValue !== 'number' || Number.isNaN(hpValue)) return null;

	return hpValue;
}

export function getActorWoundsValueAndMax(
	actor: Actor.Implementation | null | undefined,
): { value: number; max: number } | null {
	if (!actor) return null;

	const wounds = (actor as unknown as ActorHpData).system?.attributes?.wounds;
	const woundValue = wounds?.value;
	const woundMax = wounds?.max;

	if (
		typeof woundValue !== 'number' ||
		typeof woundMax !== 'number' ||
		Number.isNaN(woundValue) ||
		Number.isNaN(woundMax) ||
		woundMax <= 0
	) {
		return null;
	}

	return { value: woundValue, max: woundMax };
}

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
