import type { NimbleCharacter } from '#documents/actor/character.js';
import resolveCharacterItemActionCost, {
	type ActivatableItem,
} from '#documents/actor/resolveCharacterItemActionCost.js';
import { findToggleEffectAE, findToggleEffectRule } from '#utils/actor/toggleEffectControl.js';
import { validateItemChargeConsumption } from '#utils/chargePool/chargePoolConsume.js';
import { getPools, getPoolsForItem } from '#utils/chargePool/chargePoolSync.js';
import { getChargeConsumers } from '#utils/chargePool/helpers.js';
import type { ChargePoolState, RuleBackedItem } from '#utils/chargePool/types.js';
import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { resolveFormulaToInteger } from '#utils/dicePool/helpers.js';
import { isResourceSpendingAutomationEnabled } from '../../../settings/automationSettings.js';
import type {
	ChargeGateLike,
	DiceConsumerLike,
	HeroItemState,
	ItemPoolLike,
	PoolRecovery,
} from './heroSource.ts';

const RECOVERY_ORDER: [PoolRecovery, string[]][] = [
	['round', ['onTurnStart', 'onTurnEnd']],
	['encounter', ['encounterStart', 'encounterEnd']],
	['fieldRest', ['fieldRest']],
	['safeRest', ['safeRest']],
];

/** The most frequent recovery of the pool, in the words of the row. */
export function recoveryOf(triggers: string[]): PoolRecovery | null {
	return (
		RECOVERY_ORDER.find(([, names]) => names.some((name) => triggers.includes(name)))?.[0] ?? null
	);
}

const triggersOf = (pool: ChargePoolState) => (pool.recoveries ?? []).map((entry) => entry.trigger);

function poolsOf(actor: NimbleCharacter, item: Item, all: ChargePoolState[]): ItemPoolLike[] {
	const document = actor as unknown as Actor.Implementation;
	const consumers = getChargeConsumers(
		document as unknown as Parameters<typeof getChargeConsumers>[0],
		item as unknown as RuleBackedItem,
		{ includeVariable: true },
	);
	return getPoolsForItem(document, item.id ?? '', all).map((pool) => ({
		id: pool.id,
		label: pool.label,
		current: pool.current,
		max: pool.max,
		need: Math.max(
			1,
			consumers
				.filter((consumer) => consumer.poolId === pool.id)
				.reduce((sum, consumer) => sum + consumer.cost, 0),
		),
		per: recoveryOf(triggersOf(pool)),
	}));
}

function gateOf(item: Item, all: ChargePoolState[]): ChargeGateLike | null {
	if (!isResourceSpendingAutomationEnabled()) return null;
	const result = validateItemChargeConsumption(item);
	if (result.ok || !result.failure) return null;
	const { failure } = result;
	const pool = all.find((entry) => entry.identifier === failure.poolIdentifier);
	return {
		code: failure.code as ChargeGateLike['code'],
		poolLabel: pool?.label ?? failure.poolLabel,
		poolMax: pool?.max ?? 0,
		per: pool ? recoveryOf(triggersOf(pool)) : null,
	};
}

function toggleOf(actor: NimbleCharacter, item: Item): HeroItemState['toggle'] {
	const rule = findToggleEffectRule(item as unknown as Parameters<typeof findToggleEffectRule>[0]);
	if (!rule) return null;
	const effect = findToggleEffectAE(
		actor as unknown as Parameters<typeof findToggleEffectAE>[0],
		rule.id,
	);
	return { ruleId: rule.id, on: !!effect && !effect.disabled };
}

function diceConsumersByItem(actor: NimbleCharacter): Map<string, DiceConsumerLike[]> {
	const document = actor as unknown as Actor.Implementation;
	const byItem = new Map<string, DiceConsumerLike[]>();
	for (const pool of getDicePools(document)) {
		for (const consumer of getDicePoolConsumers(document, pool)) {
			const entry: DiceConsumerLike = {
				ruleId: consumer.ruleId,
				poolId: pool.id,
				label: consumer.ruleLabel || consumer.itemName,
				cap:
					consumer.selectionOutcome === 'consume'
						? null
						: Math.max(
								1,
								resolveFormulaToInteger(
									document as unknown as Parameters<typeof resolveFormulaToInteger>[0],
									consumer.cost,
								),
							),
				maximize: consumer.selectionOutcome === 'maximize',
			};
			byItem.set(consumer.itemId, [...(byItem.get(consumer.itemId) ?? []), entry]);
		}
	}
	return byItem;
}

/** What the system works out for each item of the hero: action cost, pools, gate, toggle, dice consumers. */
export function heroItemStates(actor: NimbleCharacter): Record<string, HeroItemState> {
	const all = getPools(actor as unknown as Actor.Implementation);
	const consumers = diceConsumersByItem(actor);
	const states: Record<string, HeroItemState> = {};
	for (const item of actor.reactive.items) {
		const id = item.id ?? '';
		states[id] = {
			actionCost: resolveCharacterItemActionCost(
				actor as unknown as Parameters<typeof resolveCharacterItemActionCost>[0],
				item as unknown as ActivatableItem,
			),
			pools: poolsOf(actor, item, all),
			gate: gateOf(item, all),
			toggle: toggleOf(actor, item),
			diceConsumers: consumers.get(id) ?? [],
		};
	}
	return states;
}
