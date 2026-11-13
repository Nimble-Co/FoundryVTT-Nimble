import { isMonsterActorType } from '#documents/actor/monsterActorTypes.js';

/**
 * How an attack reaches its target, derived from the activation's attack type.
 * `null` covers hero activations that declare no attack type at all (most
 * spells, consumables, utility features): those are neither melee nor ranged,
 * so a filtered rule never matches them.
 */
type AttackDelivery = 'melee' | 'ranged' | null;

/** The deliveries a rule can be limited to. `any` also matches an attack with no delivery. */
const ATTACK_DELIVERY_FILTERS = ['any', 'melee', 'ranged'] as const;

/** A rule-side restriction on the deliveries it applies to. */
type AttackDeliveryFilter = (typeof ATTACK_DELIVERY_FILTERS)[number];

/** What an attack is made with, as a rule can limit it. */
const ATTACK_SOURCES = ['any', 'weapon', 'spell'] as const;
type AttackSourceFilter = (typeof ATTACK_SOURCES)[number];

/** `'any'` matches all; else the item's type says weapon or spell. */
function matchesAttackSource(
	filter: AttackSourceFilter | null | undefined,
	item: { type?: string } | null | undefined,
): boolean {
	if (!filter || filter === 'any') return true;
	return (item?.type === 'spell' ? 'spell' : 'weapon') === filter;
}

/** The parts of an activation that say how its attack is delivered. */
interface AttackActivation {
	targets?: { attackType?: string | null } | null;
	acquireTargetsFromTemplate?: boolean | null;
	template?: { shape?: string | null } | null;
}

/**
 * How an attack by `user` with this activation is delivered. A monster attack
 * with no attack type has Reach 1 (GM 979), so it is melee; a monster area
 * attack with none follows its own rules (Core 1403) and has no delivery.
 */
function deliveryOfAttack(
	activation: AttackActivation | null | undefined,
	user: { type?: string | null } | null | undefined,
): AttackDelivery {
	const attackType = activation?.targets?.attackType;
	if (attackType === 'reach') return 'melee';
	if (attackType === 'range') return 'ranged';
	if (attackType || !isMonsterActorType(user?.type)) return null;
	const area = !!activation?.acquireTargetsFromTemplate && !!activation.template?.shape;
	return area ? null : 'melee';
}

/**
 * `'any'` (or absent/null) matches any delivery; otherwise the filter must
 * equal the attack's own delivery.
 */
function matchesAttackDelivery(
	filter: AttackDeliveryFilter | null | undefined,
	delivery: AttackDelivery,
): boolean {
	if (filter === null || filter === undefined || filter === 'any') return true;
	return filter === delivery;
}

export {
	ATTACK_SOURCES,
	type AttackSourceFilter,
	matchesAttackSource,
	ATTACK_DELIVERY_FILTERS,
	deliveryOfAttack,
	matchesAttackDelivery,
};
export type { AttackActivation, AttackDelivery, AttackDeliveryFilter };
