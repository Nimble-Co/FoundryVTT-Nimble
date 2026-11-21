import type { ResourceCost } from '#types/resourceCost.d.ts';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';

const CAST_MANA = '@castManaSpent';

/** Whether a cost amount reads the mana the cast spends on the spell. */
export function readsCastMana(amount: unknown): boolean {
	return typeof amount === 'string' && amount.includes(CAST_MANA);
}

type CastManaActor = { getRollData?: () => object } | null | undefined;

/**
 * The cost with an amount that reads `@castManaSpent` worked out for a cast that spends
 * `castMana`, or null when its formula cannot be worked out.
 */
export function castManaCostOf(
	actor: CastManaActor,
	cost: ResourceCost,
	castMana: number,
): ResourceCost | null {
	if (!readsCastMana(cost.amount)) return cost;
	const rollData = { ...(actor?.getRollData?.() ?? {}), castManaSpent: castMana };
	const value = getDeterministicBonus(String(cost.amount), rollData as never);
	const amount = Math.floor(Number(value));
	if (value === null || !Number.isFinite(amount)) return null;
	return { ...cost, amount: Math.max(0, amount) };
}

/** As `castManaCostOf`, for a preview: a formula that cannot be worked out shows 0. */
export function withCastMana(
	actor: CastManaActor,
	cost: ResourceCost,
	castMana: number,
): ResourceCost {
	return castManaCostOf(actor, cost, castMana) ?? { ...cost, amount: 0 };
}
