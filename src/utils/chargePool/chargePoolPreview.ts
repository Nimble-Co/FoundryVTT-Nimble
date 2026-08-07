import {
	applyRecoveryTriggersToPools,
	buildEffectiveChargePoolMap,
	isCharacterActor,
} from './helpers.js';
import type { ChargePoolRecoveryPreview, ChargeRecoveryTrigger } from './types.js';

function previewRecovery(
	actor: Actor | null | undefined,
	trigger: ChargeRecoveryTrigger,
): ChargePoolRecoveryPreview[] {
	if (!isCharacterActor(actor)) return [];

	const currentPools = buildEffectiveChargePoolMap(actor);
	const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [trigger]);
	const previews: ChargePoolRecoveryPreview[] = [];

	for (const pool of Object.values(currentPools)) {
		// Preview feeds rest UI and the rest summary card, both of which read as a
		// list of the player's resources. A hidden pool still recovers (that runs
		// off the pool map, not off this preview); it just is not announced,
		// because the player has no readout of it to reconcile the line against.
		if (pool.hidden) continue;
		if (!pool.recoveries.some((recovery) => recovery.trigger === trigger)) continue;
		const nextPool = nextPools[pool.id];
		if (!nextPool) continue;

		previews.push({
			poolId: pool.id,
			label: pool.label,
			icon: pool.icon,
			previousValue: pool.current,
			newValue: nextPool.current,
			maxValue: nextPool.max,
			recoveredAmount: Math.max(0, nextPool.current - pool.current),
		});
	}

	return previews.sort((a, b) => a.label.localeCompare(b.label));
}

export { previewRecovery };
