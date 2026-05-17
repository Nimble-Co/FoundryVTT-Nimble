import { emitForCharacter } from './chargePoolHooks.js';
import {
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	isCharacterActor,
	persistChargePoolMap,
} from './helpers.js';
import type { CharacterActorLike } from './types.js';

/**
 * Roll a die of the pool's `dieSize` and spend one charge.
 *
 * Used by sheet UI for roll-on-spend resources where the charge count is just
 * "how many times this turn can I roll this die" (e.g. Commander Combat Dice,
 * Artificer Mana Dice). Posts a chat message with the roll, then decrements
 * the pool by one charge.
 *
 * Returns `false` when the pool is empty, the pool doesn't exist, or the pool
 * has no `dieSize` configured (in which case the caller should use a different
 * spend path — chargeConsumer or adjustPool).
 */
async function rollChargeDie(
	actor: Actor | null | undefined,
	poolId: string,
	options: { flavor?: string } = {},
): Promise<{ rolled: number; remaining: number } | null> {
	if (!isCharacterActor(actor)) return null;
	if (typeof poolId !== 'string' || poolId.length < 1) return null;

	const currentPools = buildEffectiveChargePoolMap(actor);
	const pool = currentPools[poolId];
	if (!pool) return null;
	if (!pool.dieSize) return null;
	if (pool.current < 1) return null;

	const faces = Number(pool.dieSize.slice(1));
	if (!Number.isFinite(faces) || faces < 1) return null;

	const RollCls = (globalThis as unknown as { Roll: typeof Roll }).Roll;
	const roll = new RollCls(`1d${faces}`);
	await roll.evaluate();
	const ChatMessageCls = (globalThis as unknown as { ChatMessage: typeof ChatMessage }).ChatMessage;
	await roll.toMessage({
		speaker: ChatMessageCls.getSpeaker({ actor }),
		flavor: options.flavor ?? pool.label,
	});

	const previousValue = pool.current;
	pool.current = clampCurrentToMax(pool.current - 1, pool.max);

	await persistChargePoolMap(actor, currentPools);

	emitForCharacter(actor, 'changed', {
		actor: actor as CharacterActorLike,
		poolId,
		poolLabel: pool.label,
		previousValue,
		newValue: pool.current,
		maxValue: pool.max,
		reason: 'consume',
		trigger: 'manual',
	});

	return { rolled: roll.total ?? 0, remaining: pool.current };
}

export { rollChargeDie };
