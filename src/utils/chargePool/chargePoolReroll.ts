import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { firesCritTriggers } from '../firesCritTriggers.js';
import { emitForCharacter } from './chargePoolHooks.js';
import {
	applyRecoveryTriggersToPools,
	areChargePoolMapsEqual,
	buildEffectiveChargePoolMap,
	clampCurrentToMax,
	getApplicableUsageTriggers,
	isCharacterActor,
	persistChargePoolMap,
} from './helpers.js';
import type {
	CharacterActorLike,
	ChargePoolMap,
	ChargeRecoveryGiven,
	ChargeRecoveryTrigger,
} from './types.js';

/** Card flag with what each attack recovery trigger gave on each pool. */
const RECOVERY_GIVEN_FLAG = 'chargeRecoveryGiven';

interface AttackOutcome {
	isCritical?: boolean;
	isMiss?: boolean;
}

interface RecoveryTriggerChange {
	takeBack: ChargeRecoveryTrigger[];
	give: ChargeRecoveryTrigger[];
}

/** The attack recovery triggers an outcome fires, as item use reads them. */
function attackRecoveryTriggers(
	outcome: AttackOutcome,
	critStillCounts: boolean,
): ChargeRecoveryTrigger[] {
	if (
		firesCritTriggers({ isCritical: outcome.isCritical, discardedCritTriggers: critStillCounts })
	) {
		return getApplicableUsageTriggers({ isMiss: false, isCritical: true });
	}
	return getApplicableUsageTriggers({ isMiss: outcome.isMiss === true, isCritical: false });
}

/**
 * Which attack recovery triggers a reroll takes back and gives. A discarded
 * crit that still counts keeps the crit for both rolls, so it changes nothing.
 */
function rerollRecoveryChange(
	previous: AttackOutcome,
	next: AttackOutcome,
	critStillCounts: boolean,
): RecoveryTriggerChange {
	const before = attackRecoveryTriggers(previous, critStillCounts);
	const after = attackRecoveryTriggers(next, critStillCounts);
	return {
		takeBack: before.filter((trigger) => !after.includes(trigger)),
		give: after.filter((trigger) => !before.includes(trigger)),
	};
}

/** Undo what `triggers` gave; a pool spent since loses only what it has. */
function takeBackRecovery(
	pools: ChargePoolMap,
	given: ChargeRecoveryGiven,
	triggers: ChargeRecoveryTrigger[],
): ChargeRecoveryGiven {
	const kept: ChargeRecoveryGiven = [];
	for (const entry of given) {
		if (!triggers.includes(entry.trigger)) {
			kept.push(entry);
			continue;
		}
		const pool = pools[entry.poolId];
		if (pool) pool.current = clampCurrentToMax(pool.current - entry.change, pool.max);
	}
	return kept;
}

/**
 * Make the attacker's charge pools follow a rerolled attack: take back what
 * the triggers in `change.takeBack` gave, then give what `change.give` earns.
 * `given` is what the card's recoveries gave so far; the updated copy is
 * returned, or null when nothing ran. Gated like the item use recovery.
 */
async function applyRerollRecoveryChange(
	actor: Actor | null | undefined,
	change: RecoveryTriggerChange,
	given: ChargeRecoveryGiven | null | undefined,
): Promise<ChargeRecoveryGiven | null> {
	if (change.takeBack.length < 1 && change.give.length < 1) return null;
	if (!isResourceSpendingAutomationEnabled()) return null;
	if (!isCharacterActor(actor)) return null;

	const currentPools = buildEffectiveChargePoolMap(actor);
	const takenBack = foundry.utils.deepClone(currentPools) as ChargePoolMap;
	const nextGiven = foundry.utils.deepClone(
		takeBackRecovery(takenBack, Array.isArray(given) ? given : [], change.takeBack),
	);
	const nextPools = applyRecoveryTriggersToPools(actor, takenBack, change.give, nextGiven);

	if (!areChargePoolMapsEqual(currentPools, nextPools)) {
		await persistChargePoolMap(actor, nextPools);
		emitChanges(actor, currentPools, nextPools, change);
	}

	return nextGiven;
}

function emitChanges(
	actor: CharacterActorLike,
	currentPools: ChargePoolMap,
	nextPools: ChargePoolMap,
	change: RecoveryTriggerChange,
): void {
	const trigger = change.give.at(-1) ?? change.takeBack.at(-1);
	for (const [poolId, nextPool] of Object.entries(nextPools)) {
		const prePool = currentPools[poolId];
		if (!prePool || prePool.current === nextPool.current) continue;
		emitForCharacter(actor, 'changed', {
			actor,
			poolId,
			poolLabel: nextPool.label,
			previousValue: prePool.current,
			newValue: nextPool.current,
			maxValue: nextPool.max,
			reason: 'recovery',
			trigger,
		});
	}
}

export {
	RECOVERY_GIVEN_FLAG,
	applyRerollRecoveryChange,
	rerollRecoveryChange,
	type AttackOutcome,
	type RecoveryTriggerChange,
};
