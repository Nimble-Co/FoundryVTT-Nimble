import type { NimbleRollData } from '#types/rollData.d.ts';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import type {
	CharacterActorLike,
	ChargeConsumerRuleLike,
	ChargeConsumerState,
	ChargePoolDefinition,
	ChargePoolInitialMode,
	ChargePoolMap,
	ChargePoolRuleLike,
	ChargePoolScope,
	ChargePoolState,
	ChargeRecoveryEntry,
	ChargeRecoveryMode,
	ChargeRecoveryTrigger,
	NumericInput,
	RuleBackedItem,
} from './types.js';

const VALID_RECOVERY_TRIGGERS: Set<ChargeRecoveryTrigger> = new Set(
	ChargePoolRuleConfig.recoveryTriggers,
);
const VALID_RECOVERY_MODES: Set<ChargeRecoveryMode> = new Set(ChargePoolRuleConfig.recoveryModes);

function isCharacterActor(actor: Actor | null | undefined): actor is CharacterActorLike {
	return actor?.type === 'character';
}

function toFiniteNonNegativeInteger(value: NumericInput): number {
	const numericValue = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.max(0, Math.floor(numericValue));
}

function toNumericInput(value: unknown): NumericInput {
	if (typeof value === 'number' || typeof value === 'string') return value;
	if (value === null || value === undefined) return value;
	return undefined;
}

function clampCurrentToMax(current: number, max: number): number {
	return Math.max(0, Math.min(current, max));
}

function normalizeIdentifier(identifier: unknown): string {
	if (typeof identifier !== 'string') return '';
	return identifier.trim();
}

function normalizeIcon(icon: unknown): string | undefined {
	if (typeof icon !== 'string') return undefined;
	const trimmed = icon.trim();
	if (trimmed.length < 1) return undefined;
	return trimmed;
}

function buildChargePoolId(
	scope: ChargePoolScope,
	identifier: string,
	_poolSourceItemId: string,
): string {
	if (scope === 'actor') {
		return `actor:${identifier}`;
	}

	return identifier;
}

function toChargePoolScope(value: unknown): ChargePoolScope {
	return value === 'actor' ? 'actor' : 'item';
}

function getChargePoolMapFromActor(actor: CharacterActorLike): ChargePoolMap {
	const normalizedRecord: ChargePoolMap = {};

	const rawActorPools = foundry.utils.getProperty(actor, ChargePoolRuleConfig.flagPath);
	if (rawActorPools && typeof rawActorPools === 'object' && !Array.isArray(rawActorPools)) {
		const sourceRecord = rawActorPools as Record<string, unknown>;
		for (const [poolId, poolValue] of Object.entries(sourceRecord)) {
			if (!poolValue || typeof poolValue !== 'object' || Array.isArray(poolValue)) continue;
			if (!poolId.startsWith('actor:')) continue;

			const sourcePool = poolValue as Record<string, unknown>;
			const max = toFiniteNonNegativeInteger(toNumericInput(sourcePool.max));
			const current = clampCurrentToMax(
				toFiniteNonNegativeInteger(toNumericInput(sourcePool.current)),
				max,
			);

			const recoveries = normalizeRecoveries(sourcePool.recoveries);
			const identifier = normalizeIdentifier(sourcePool.identifier);
			const sourceItemId = normalizeIdentifier(sourcePool.sourceItemId);
			const sourceItemName = normalizeIdentifier(sourcePool.sourceItemName);
			const label = normalizeIdentifier(sourcePool.label);
			if (identifier.length < 1) continue;

			normalizedRecord[poolId] = {
				id: poolId,
				identifier,
				scope: 'actor',
				sourceItemId,
				sourceItemName,
				label: label || sourceItemName || identifier,
				current,
				max,
				icon: normalizeIcon(sourcePool.icon),
				recoveries,
			};
		}
	}

	for (const item of actor.items.contents) {
		const itemFlags = item.flags as Record<string, unknown>;
		const nimbleFlags = itemFlags.nimble;
		if (!nimbleFlags || typeof nimbleFlags !== 'object' || Array.isArray(nimbleFlags)) continue;
		const chargePoolsOnItem = (nimbleFlags as Record<string, unknown>).chargePools;
		if (
			!chargePoolsOnItem ||
			typeof chargePoolsOnItem !== 'object' ||
			Array.isArray(chargePoolsOnItem)
		) {
			continue;
		}

		const itemPoolRecord = chargePoolsOnItem as Record<string, unknown>;
		for (const [poolIdentifier, poolValue] of Object.entries(itemPoolRecord)) {
			if (!poolValue || typeof poolValue !== 'object' || Array.isArray(poolValue)) continue;

			const sourcePool = poolValue as Record<string, unknown>;
			const max = toFiniteNonNegativeInteger(toNumericInput(sourcePool.max));
			const current = clampCurrentToMax(
				toFiniteNonNegativeInteger(toNumericInput(sourcePool.current)),
				max,
			);
			const recoveries = normalizeRecoveries(sourcePool.recoveries);
			const normalizedIdentifier = normalizeIdentifier(poolIdentifier);
			if (normalizedIdentifier.length < 1) continue;

			const poolId = normalizedIdentifier;
			normalizedRecord[poolId] = {
				id: poolId,
				identifier: normalizedIdentifier,
				scope: 'item',
				sourceItemId: item.id ?? '',
				sourceItemName: item.name ?? '',
				label: item.name || normalizedIdentifier,
				current,
				max,
				icon: normalizeIcon(sourcePool.icon),
				recoveries,
			};
		}
	}

	return normalizedRecord;
}

function resolveFormulaToInteger(actor: CharacterActorLike, formula: unknown): number {
	if (typeof formula !== 'string' || formula.trim().length < 1) return 0;
	const resolvedValue = getDeterministicBonus(formula, actor.getRollData() as NimbleRollData);
	return toFiniteNonNegativeInteger(resolvedValue);
}

function normalizeRecoveries(value: unknown): ChargeRecoveryEntry[] {
	if (!Array.isArray(value)) return [];

	const recoveries: ChargeRecoveryEntry[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
		const sourceEntry = entry as Record<string, unknown>;
		const trigger = sourceEntry.trigger;
		if (
			typeof trigger !== 'string' ||
			!VALID_RECOVERY_TRIGGERS.has(trigger as ChargeRecoveryTrigger)
		) {
			continue;
		}

		const modeValue = sourceEntry.mode;
		const mode = VALID_RECOVERY_MODES.has(modeValue as ChargeRecoveryMode)
			? (modeValue as ChargeRecoveryMode)
			: 'add';
		const formula = typeof sourceEntry.value === 'string' ? sourceEntry.value : '1';

		recoveries.push({
			trigger: trigger as ChargeRecoveryTrigger,
			mode,
			value: formula,
		});
	}

	return recoveries;
}

function getChargePoolDefinitions(actor: CharacterActorLike): ChargePoolDefinition[] {
	const definitions: ChargePoolDefinition[] = [];

	for (const item of actor.items.contents) {
		const ruleBackedItem = item as RuleBackedItem;
		const rules = ruleBackedItem.rules;
		if (!rules) continue;
		const sourceItemId = normalizeIdentifier(item.id);
		if (sourceItemId.length < 1) continue;

		for (const rule of rules.values()) {
			if (rule.type !== 'chargePool' || rule.disabled) continue;
			const poolRule = rule as ChargePoolRuleLike;
			const identifier = normalizeIdentifier(poolRule.identifier || poolRule.id);
			if (identifier.length < 1) continue;

			const scope = toChargePoolScope(poolRule.scope);
			const max = resolveFormulaToInteger(actor, poolRule.max);
			const id = buildChargePoolId(scope, identifier, sourceItemId);
			const initial: ChargePoolInitialMode = poolRule.initial === 'zero' ? 'zero' : 'max';
			const recoveries = normalizeRecoveries(poolRule.recoveries);

			definitions.push({
				id,
				identifier,
				scope,
				sourceItemId,
				sourceItemName: item.name,
				label: normalizeIdentifier(poolRule.label) || item.name || identifier,
				max,
				icon: normalizeIcon(poolRule.icon),
				initial,
				recoveries,
			});
		}
	}

	return definitions;
}

function buildEffectiveChargePoolMap(actor: CharacterActorLike): ChargePoolMap {
	const existingPools = getChargePoolMapFromActor(actor);
	const definitions = getChargePoolDefinitions(actor);
	const nextPools: ChargePoolMap = {};

	for (const definition of definitions) {
		const existingPool = existingPools[definition.id];
		const defaultCurrent = definition.initial === 'zero' ? 0 : definition.max;
		const current = clampCurrentToMax(existingPool?.current ?? defaultCurrent, definition.max);

		nextPools[definition.id] = {
			id: definition.id,
			identifier: definition.identifier,
			scope: definition.scope,
			sourceItemId: definition.sourceItemId,
			sourceItemName: definition.sourceItemName,
			label: definition.label,
			current,
			max: definition.max,
			icon: existingPool?.icon ?? definition.icon,
			recoveries: definition.recoveries,
		};
	}

	return nextPools;
}

function getChargeConsumers(
	actor: CharacterActorLike,
	item: RuleBackedItem,
): ChargeConsumerState[] {
	const rules = item.rules;
	if (!rules) return [];
	const sourceItemId = normalizeIdentifier(item.id);
	if (sourceItemId.length < 1) return [];

	const consumers: ChargeConsumerState[] = [];
	for (const rule of rules.values()) {
		if (rule.type !== 'chargeConsumer' || rule.disabled) continue;
		const consumerRule = rule as ChargeConsumerRuleLike;
		const poolIdentifier = normalizeIdentifier(
			consumerRule.poolIdentifier || consumerRule.identifier || consumerRule.id,
		);
		if (poolIdentifier.length < 1) continue;

		const poolScope = toChargePoolScope(consumerRule.poolScope);
		const cost = resolveFormulaToInteger(actor, consumerRule.cost);
		const poolId = buildChargePoolId(poolScope, poolIdentifier, sourceItemId);
		consumers.push({
			poolId,
			poolIdentifier,
			cost,
		});
	}

	return consumers;
}

function getApplicableUsageTriggers(context: {
	isMiss?: boolean;
	isCritical?: boolean;
}): ChargeRecoveryTrigger[] {
	if (context.isMiss === true) return [];

	const triggers: ChargeRecoveryTrigger[] = ['onHit'];
	if (context.isCritical === true) {
		triggers.push('onCriticalHit');
	}

	return triggers;
}

function applyRecoveryTriggersToPools(
	actor: CharacterActorLike,
	pools: ChargePoolMap,
	triggers: ChargeRecoveryTrigger[],
): ChargePoolMap {
	if (triggers.length < 1) return pools;

	const triggerSet = new Set(triggers);
	const nextPools = foundry.utils.deepClone(pools) as ChargePoolMap;

	for (const pool of Object.values(nextPools)) {
		for (const recovery of pool.recoveries) {
			if (!triggerSet.has(recovery.trigger)) continue;

			if (recovery.mode === 'refresh') {
				pool.current = pool.max;
				continue;
			}

			const value = resolveFormulaToInteger(actor, recovery.value);
			if (recovery.mode === 'set') {
				pool.current = clampCurrentToMax(value, pool.max);
				continue;
			}

			pool.current = clampCurrentToMax(pool.current + value, pool.max);
		}
	}

	return nextPools;
}

function resolveRecoveryTrigger(
	pool: ChargePoolState | undefined,
	triggers: ChargeRecoveryTrigger[],
): ChargeRecoveryTrigger {
	if (!pool || triggers.length < 1) return 'onHit';

	for (let index = triggers.length - 1; index >= 0; index -= 1) {
		const trigger = triggers[index];
		if (pool.recoveries.some((recovery) => recovery.trigger === trigger)) {
			return trigger;
		}
	}

	return triggers[triggers.length - 1] ?? 'onHit';
}

function buildPoolUpdatePayload(
	existingPools: Record<string, unknown>,
	nextPools: Record<string, ChargePoolState>,
): Record<string, unknown> {
	const payload: Record<string, unknown> = {};

	for (const [poolId, poolState] of Object.entries(nextPools)) {
		payload[poolId] = poolState;
	}

	for (const existingPoolId of Object.keys(existingPools)) {
		if (existingPoolId in nextPools) continue;
		payload[`-=${existingPoolId}`] = null;
	}

	return payload;
}

async function persistChargePoolMap(
	actor: CharacterActorLike,
	pools: ChargePoolMap,
): Promise<void> {
	const itemScopedPools: Record<string, ChargePoolState> = {};
	const actorScopedPools: Record<string, ChargePoolState> = {};

	for (const [poolId, poolState] of Object.entries(pools)) {
		if (poolId.startsWith('actor:')) {
			actorScopedPools[poolId] = poolState;
		} else {
			itemScopedPools[poolId] = poolState;
		}
	}

	const itemUpdates: Promise<unknown>[] = [];
	const itemPoolsByItemId = new Map<string, Record<string, ChargePoolState>>();

	for (const [_poolId, poolState] of Object.entries(itemScopedPools)) {
		const itemId = String(poolState.sourceItemId);
		if (!itemId) continue;

		let itemPools = itemPoolsByItemId.get(itemId);
		if (!itemPools) {
			itemPools = {};
			itemPoolsByItemId.set(itemId, itemPools);
		}
		itemPools[poolState.identifier] = poolState;
	}

	for (const item of actor.items.contents) {
		const itemId = normalizeIdentifier(item.id);
		if (itemId.length < 1) continue;

		const poolsToUpdate = itemPoolsByItemId.get(itemId) ?? {};
		const existingItemPools =
			(foundry.utils.getProperty(item, ChargePoolRuleConfig.flagPath) as Record<string, unknown>) ??
			{};
		const itemPoolUpdatePayload = buildPoolUpdatePayload(existingItemPools, poolsToUpdate);
		if (Object.keys(itemPoolUpdatePayload).length < 1) continue;

		itemUpdates.push(
			item.update(
				{
					'flags.nimble.chargePools': itemPoolUpdatePayload,
				} as Record<string, unknown>,
				{
					nimble: {
						skipChargePoolSync: true,
					},
				} as Record<string, unknown>,
			),
		);
	}

	const existingActorPools =
		(foundry.utils.getProperty(actor, ChargePoolRuleConfig.flagPath) as Record<string, unknown>) ??
		{};
	const actorPoolUpdatePayload = buildPoolUpdatePayload(existingActorPools, actorScopedPools);
	if (Object.keys(actorPoolUpdatePayload).length > 0) {
		itemUpdates.push(
			actor.update(
				{
					[ChargePoolRuleConfig.flagPath]: actorPoolUpdatePayload,
				} as Record<string, unknown>,
				{
					nimble: {
						skipChargePoolSync: true,
					},
				} as Record<string, unknown>,
			),
		);
	}

	await Promise.all(itemUpdates);
}

function areRecoveryEntriesEqual(
	left: ChargeRecoveryEntry[],
	right: ChargeRecoveryEntry[],
): boolean {
	if (left.length !== right.length) return false;

	for (let index = 0; index < left.length; index += 1) {
		const leftEntry = left[index];
		const rightEntry = right[index];
		if (
			leftEntry.trigger !== rightEntry.trigger ||
			leftEntry.mode !== rightEntry.mode ||
			leftEntry.value !== rightEntry.value
		) {
			return false;
		}
	}

	return true;
}

function areChargePoolStatesEqual(left: ChargePoolState, right: ChargePoolState): boolean {
	return (
		left.id === right.id &&
		left.identifier === right.identifier &&
		left.scope === right.scope &&
		left.sourceItemId === right.sourceItemId &&
		left.sourceItemName === right.sourceItemName &&
		left.label === right.label &&
		left.current === right.current &&
		left.max === right.max &&
		left.icon === right.icon &&
		areRecoveryEntriesEqual(left.recoveries, right.recoveries)
	);
}

function areChargePoolMapsEqual(left: ChargePoolMap, right: ChargePoolMap): boolean {
	const leftIds = Object.keys(left).sort();
	const rightIds = Object.keys(right).sort();
	if (leftIds.length !== rightIds.length) return false;

	for (let index = 0; index < leftIds.length; index += 1) {
		if (leftIds[index] !== rightIds[index]) return false;
		const poolId = leftIds[index];
		const leftPool = left[poolId];
		const rightPool = right[poolId];
		if (!rightPool) return false;
		if (!areChargePoolStatesEqual(leftPool, rightPool)) return false;
	}

	return true;
}

export {
	VALID_RECOVERY_TRIGGERS,
	VALID_RECOVERY_MODES,
	isCharacterActor,
	toFiniteNonNegativeInteger,
	toNumericInput,
	clampCurrentToMax,
	normalizeIdentifier,
	normalizeIcon,
	buildChargePoolId,
	toChargePoolScope,
	getChargePoolMapFromActor,
	resolveFormulaToInteger,
	normalizeRecoveries,
	getChargePoolDefinitions,
	buildEffectiveChargePoolMap,
	getChargeConsumers,
	getApplicableUsageTriggers,
	applyRecoveryTriggersToPools,
	resolveRecoveryTrigger,
	buildPoolUpdatePayload,
	persistChargePoolMap,
	areRecoveryEntriesEqual,
	areChargePoolStatesEqual,
	areChargePoolMapsEqual,
};
