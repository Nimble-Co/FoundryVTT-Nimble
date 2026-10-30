/**
 * How an attack reaches its target, derived from the activation's attack type.
 * `null` covers activations that declare no attack type at all (most spells,
 * consumables, utility features): those are neither melee nor ranged, so a
 * filtered rule never matches them.
 */
type AttackDelivery = 'melee' | 'ranged' | null;

/** The deliveries a rule can be limited to. `any` also matches an attack with no delivery. */
const ATTACK_DELIVERY_FILTERS = ['any', 'melee', 'ranged'] as const;

/** A rule-side restriction on the deliveries it applies to. */
type AttackDeliveryFilter = (typeof ATTACK_DELIVERY_FILTERS)[number];

/**
 * Maps an activation's attack type to the channel it is delivered through.
 * The parameter is loose because every caller reads it off weakly-typed
 * document data; anything that is not one of the two known types is no
 * delivery at all.
 */
function attackDeliveryFromAttackType(attackType: string | null | undefined): AttackDelivery {
	if (attackType === 'reach') return 'melee';
	if (attackType === 'range') return 'ranged';
	return null;
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

export { ATTACK_DELIVERY_FILTERS, attackDeliveryFromAttackType, matchesAttackDelivery };
export type { AttackDelivery, AttackDeliveryFilter };
