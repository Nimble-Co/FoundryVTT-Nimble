import type { ResourceCost } from '#types/resourceCost.d.ts';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';

const CAST_MANA = '@castManaSpent';

/** Whether a cost amount reads the mana the cast spends on the spell. */
export function readsCastMana(amount: unknown): boolean {
	return typeof amount === 'string' && amount.includes(CAST_MANA);
}

/** The cost with an amount that reads `@castManaSpent` worked out for a cast that spends `castMana`. */
export function withCastMana(
	actor: { getRollData?: () => object } | null | undefined,
	cost: ResourceCost,
	castMana: number,
): ResourceCost {
	if (!readsCastMana(cost.amount)) return cost;
	const rollData = { ...(actor?.getRollData?.() ?? {}), castManaSpent: castMana };
	const amount = Math.floor(Number(getDeterministicBonus(String(cost.amount), rollData as never)));
	return { ...cost, amount: Number.isFinite(amount) ? Math.max(0, amount) : 0 };
}
