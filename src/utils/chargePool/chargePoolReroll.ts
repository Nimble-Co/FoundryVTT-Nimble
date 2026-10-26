import { isResourceSpendingAutomationEnabled } from '../../settings/automationSettings.js';
import { critTriggerOutcome } from '../firesCritTriggers.js';
import type { AttackOutcomeView } from '../incomingReactionEntry.js';
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
	ChargeConsumptionDetail,
	ChargePoolMap,
	ChargeRecoveryGiven,
	ChargeRecoveryTrigger,
} from './types.js';

/** Card flag with what each attack recovery trigger gave on each pool. */
const RECOVERY_GIVEN_FLAG = 'chargeRecoveryGiven';

interface RecoveryTriggerChange {
	takeBack: ChargeRecoveryTrigger[];
	give: ChargeRecoveryTrigger[];
}

interface RerollRecoveryResult {
	given: ChargeRecoveryGiven;
	pools: ChargePoolMap;
}

/** The attack recovery triggers an outcome fires, as item use reads them. */
function attackRecoveryTriggers(
	outcome: AttackOutcomeView,
	critStillCounts: boolean,
): ChargeRecoveryTrigger[] {
	return getApplicableUsageTriggers(
		critTriggerOutcome({
			isCritical: outcome.isCritical,
			isMiss: outcome.isMiss,
			discardedCritTriggers: critStillCounts,
		}),
	);
}

/**
 * Which attack recovery triggers a reroll takes back and gives. A discarded
 * crit that still counts keeps the crit for both rolls, so it changes nothing.
 */
function rerollRecoveryChange(
	previous: AttackOutcomeView,
	next: AttackOutcomeView,
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
 * `given` is what the card's recoveries gave so far. Returns the updated copy
 * and the pools after the change, or null when nothing ran. Gated like the
 * item use recovery.
 */
async function applyRerollRecoveryChange(
	actor: Actor | null | undefined,
	change: RecoveryTriggerChange,
	given: ChargeRecoveryGiven | null | undefined,
): Promise<RerollRecoveryResult | null> {
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

	return { given: nextGiven, pools: nextPools };
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

/** Item use names a pool's refill after the last of these triggers that gave. */
const TRIGGER_ORDER: ChargeRecoveryTrigger[] = getApplicableUsageTriggers({ isCritical: true });

interface NetRefill {
	change: number;
	trigger: ChargeRecoveryTrigger;
}

function netRefillsByPool(given: ChargeRecoveryGiven): Map<string, NetRefill> {
	const refills = new Map<string, NetRefill>();
	for (const entry of given) {
		const refill = refills.get(entry.poolId);
		if (!refill) {
			refills.set(entry.poolId, { change: entry.change, trigger: entry.trigger });
			continue;
		}
		refill.change += entry.change;
		if (TRIGGER_ORDER.indexOf(entry.trigger) >= TRIGGER_ORDER.indexOf(refill.trigger)) {
			refill.trigger = entry.trigger;
		}
	}
	return refills;
}

/** The pool an entry is for; an entry without a pool id matches a unique label. */
function entryPoolId(entry: ChargeConsumptionDetail, pools: ChargePoolMap): string | null {
	if (entry.poolId) return entry.poolId;
	const matches = Object.entries(pools).filter(([, pool]) => pool.label === entry.poolLabel);
	return matches.length === 1 ? matches[0][0] : null;
}

function copyEntry(entry: ChargeConsumptionDetail): ChargeConsumptionDetail {
	return entry.recovery ? { ...entry, recovery: { ...entry.recovery } } : { ...entry };
}

/**
 * The card's charge lines after a reroll. Each pool keeps its spend; its
 * refill becomes the net that `given` now records for it. A line left with
 * neither is dropped, a pool newly refilled gets a line, and a line that
 * matches no pool is left as it was.
 */
function rerollChargeConsumption(
	consumption: ChargeConsumptionDetail[],
	given: ChargeRecoveryGiven,
	pools: ChargePoolMap,
): ChargeConsumptionDetail[] {
	const refills = netRefillsByPool(given);
	const next = consumption.map(copyEntry);

	// One line per pool carries its refill: the one that has it, else the last.
	const carriers = new Map<string, ChargeConsumptionDetail>();
	for (const entry of next) {
		const poolId = entryPoolId(entry, pools);
		if (!poolId) continue;
		if (carriers.get(poolId)?.recovery) continue;
		carriers.set(poolId, entry);
	}

	for (const [poolId, entry] of carriers) {
		const refill = refills.get(poolId);
		if (!refill || refill.change === 0) {
			delete entry.recovery;
			continue;
		}
		entry.recovery = {
			trigger: refill.trigger,
			previousValue: entry.currentValue,
			newValue: clampCurrentToMax(entry.currentValue + refill.change, entry.maxValue),
		};
	}

	for (const [poolId, refill] of refills) {
		const pool = pools[poolId];
		if (!pool || refill.change === 0 || carriers.has(poolId)) continue;
		const before = clampCurrentToMax(pool.current - refill.change, pool.max);
		next.push({
			poolId,
			poolLabel: pool.label,
			previousValue: before,
			currentValue: before,
			maxValue: pool.max,
			change: 0,
			recovery: { trigger: refill.trigger, previousValue: before, newValue: pool.current },
		});
	}

	const carried = new Set(carriers.values());
	return next.filter((entry) => !carried.has(entry) || entry.change !== 0 || entry.recovery);
}

export {
	RECOVERY_GIVEN_FLAG,
	applyRerollRecoveryChange,
	rerollChargeConsumption,
	rerollRecoveryChange,
	type RecoveryTriggerChange,
};
