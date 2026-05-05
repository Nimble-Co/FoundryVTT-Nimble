import type { ActorResourceData } from '#types/combat.js';

function toFiniteNumber(value: unknown): number | null {
	if (typeof value !== 'number' || Number.isNaN(value)) return null;
	return value;
}

export function getActorHpValue(actor: Actor.Implementation | null | undefined): number | null {
	if (!actor) return null;

	return toFiniteNumber((actor as unknown as ActorResourceData).system?.attributes?.hp?.value);
}

export function getActorHpMaxValue(actor: Actor.Implementation | null | undefined): number | null {
	if (!actor) return null;

	const hpMax = toFiniteNumber((actor as unknown as ActorResourceData).system?.attributes?.hp?.max);
	if (hpMax === null || hpMax <= 0) return null;
	return hpMax;
}

/**
 * Last Stand HP buffer is configured on the actor's embedded `monsterFeature`
 * item with `subtype: 'lastStand'`. Returns null when no such item exists or
 * the buffer is 0 (mechanic disabled).
 */
export function getActorLastStandHp(actor: Actor.Implementation | null | undefined): number | null {
	if (!actor) return null;

	type LastStandItemView = { type?: string; system?: { subtype?: string; lastStandHp?: number } };
	const items = (
		actor as unknown as { items?: LastStandItemView[] | { contents?: LastStandItemView[] } }
	).items;
	const list: LastStandItemView[] = Array.isArray(items) ? items : (items?.contents ?? []);

	for (const item of list) {
		if (item?.type !== 'monsterFeature') continue;
		if (item?.system?.subtype !== 'lastStand') continue;
		const value = toFiniteNumber(item.system?.lastStandHp);
		if (value === null || value <= 0) continue;
		return value;
	}
	return null;
}

export function getActorWoundsValueAndMax(
	actor: Actor.Implementation | null | undefined,
): { value: number; max: number } | null {
	if (!actor) return null;

	const wounds = (actor as unknown as ActorResourceData).system?.attributes?.wounds;
	const woundValue = toFiniteNumber(wounds?.value);
	const woundMax = toFiniteNumber(wounds?.max);

	if (woundValue === null || woundMax === null || woundMax <= 0) {
		return null;
	}

	return { value: woundValue, max: woundMax };
}

export function getActorManaValueAndMax(
	actor: Actor.Implementation | null | undefined,
): { value: number; max: number } | null {
	if (!actor) return null;

	const mana = (actor as unknown as ActorResourceData).system?.resources?.mana;
	const current = toFiniteNumber(mana?.value) ?? toFiniteNumber(mana?.current);
	const max = toFiniteNumber(mana?.max) ?? toFiniteNumber(mana?.baseMax);
	if (current === null || max === null) return null;
	if (current <= 0 && max <= 0) return null;

	return {
		value: current,
		max,
	};
}
