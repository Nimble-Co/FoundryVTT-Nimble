import type { NimbleRollData } from '#types/rollData.d.ts';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import getDeterministicBonus from '../dice/getDeterministicBonus.js';

type ChargePoolScope = (typeof ChargePoolRuleConfig.scopes)[number];
type ChargePoolInitialMode = (typeof ChargePoolRuleConfig.initialModes)[number];
type ChargeRecoveryTrigger = (typeof ChargePoolRuleConfig.recoveryTriggers)[number];
type ChargeRecoveryMode = (typeof ChargePoolRuleConfig.recoveryModes)[number];
type ChargeRestType = (typeof ChargePoolRuleConfig.restTypes)[number];
type ManualAdjustMode = (typeof ChargePoolRuleConfig.recoveryModes)[number];
type NumericInput = number | string | null | undefined;

type ChargeRecoveryEntry = {
	trigger: ChargeRecoveryTrigger;
	mode: ChargeRecoveryMode;
	value: string;
};

type ChargePoolState = {
	id: string;
	identifier: string;
	scope: ChargePoolScope;
	sourceItemId: string;
	sourceItemName: string;
	label: string;
	current: number;
	max: number;
	icon?: string;
	recoveries: ChargeRecoveryEntry[];
};

type ChargePoolMap = Record<string, ChargePoolState>;

type ChargePoolDefinition = Omit<ChargePoolState, 'current'> & {
	initial: ChargePoolInitialMode;
};

type ChargePoolRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	label?: string;
	scope?: string;
	max?: string;
	icon?: string;
	initial?: string;
	recoveries?: unknown;
};

type ChargeConsumerRuleLike = {
	type?: string;
	disabled?: boolean;
	id?: string;
	identifier?: string;
	poolIdentifier?: string;
	poolScope?: string;
	cost?: string;
};

type RuleLike = ChargePoolRuleLike & ChargeConsumerRuleLike;

type RuleBackedItem = Item.Implementation & {
	rules?: Map<string, RuleLike>;
};

type CharacterActorLike = Actor.Implementation & {
	type: 'character';
	items: foundry.abstract.EmbeddedCollection<Item.Implementation, Actor.Implementation>;
	getRollData(): Record<string, unknown>;
};

type ChargeConsumerState = {
	poolId: string;
	poolIdentifier: string;
	cost: number;
};

type ChargeContext = {
	isMiss?: boolean;
	isCritical?: boolean;
};

type ChargeValidationFailure = {
	code: 'poolMissing' | 'insufficientCharges';
	poolIdentifier: string;
	poolLabel: string;
	required: number;
	available: number;
};

type ChargeConsumptionDetail = {
	poolLabel: string;
	previousValue: number;
	currentValue: number;
	maxValue: number;
	change: number;
	recovery?: {
		trigger: string;
		previousValue: number;
		newValue: number;
	};
};

type ChargeValidationResult = {
	ok: boolean;
	failure?: ChargeValidationFailure;
	consumption?: ChargeConsumptionDetail[];
};

type ChargePoolRecoveryPreview = {
	poolId: string;
	label: string;
	icon?: string;
	previousValue: number;
	newValue: number;
	maxValue: number;
	recoveredAmount: number;
};

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

function getApplicableUsageTriggers(context: ChargeContext): ChargeRecoveryTrigger[] {
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

const ChargePoolService = {
	isChargePoolFlagUpdate(options: unknown): boolean {
		if (!options || typeof options !== 'object') return false;
		return Boolean(
			foundry.utils.getProperty(options, `${ChargePoolRuleConfig.flagScope}.skipChargePoolSync`),
		);
	},

	getPools(actor: Actor | null | undefined): ChargePoolState[] {
		if (!isCharacterActor(actor)) return [];

		return Object.values(buildEffectiveChargePoolMap(actor)).sort((a, b) =>
			a.label.localeCompare(b.label),
		);
	},

	getPoolsForItem(
		actor: Actor | null | undefined,
		itemId: string,
		pools?: ChargePoolState[],
	): ChargePoolState[] {
		if (!isCharacterActor(actor)) return [];
		const normalizedItemId = normalizeIdentifier(itemId);
		if (normalizedItemId.length < 1) return [];

		const availablePools = pools ?? ChargePoolService.getPools(actor);
		const item = actor.items.get(normalizedItemId) as RuleBackedItem | undefined;
		if (!item) {
			return availablePools.filter((pool) => pool.sourceItemId === normalizedItemId);
		}

		const consumers = getChargeConsumers(actor, item);
		const consumerPoolIds = new Set(consumers.map((consumer) => consumer.poolId));
		return availablePools.filter(
			(pool) => pool.sourceItemId === normalizedItemId || consumerPoolIds.has(pool.id),
		);
	},

	previewRecovery(
		actor: Actor | null | undefined,
		trigger: ChargeRecoveryTrigger,
	): ChargePoolRecoveryPreview[] {
		if (!isCharacterActor(actor)) return [];

		const currentPools = buildEffectiveChargePoolMap(actor);
		const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [trigger]);
		const previews: ChargePoolRecoveryPreview[] = [];

		for (const pool of Object.values(currentPools)) {
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
	},

	async syncActorPools(actor: Actor | null | undefined): Promise<void> {
		if (!isCharacterActor(actor)) return;

		const existingPools = getChargePoolMapFromActor(actor);
		const nextPools = buildEffectiveChargePoolMap(actor);
		if (areChargePoolMapsEqual(existingPools, nextPools)) return;

		await persistChargePoolMap(actor, nextPools);
	},

	validateItemChargeConsumption(item: Item | null | undefined): ChargeValidationResult {
		if (!item) return { ok: true };
		const ruleBackedItem = item as RuleBackedItem;
		const actor = item.actor;
		if (!isCharacterActor(actor)) return { ok: true };

		const pools = buildEffectiveChargePoolMap(actor);
		const consumers = getChargeConsumers(actor, ruleBackedItem);
		for (const consumer of consumers) {
			const pool = pools[consumer.poolId];
			if (!pool) {
				return {
					ok: false,
					failure: {
						code: 'poolMissing',
						poolIdentifier: consumer.poolIdentifier,
						poolLabel: consumer.poolIdentifier,
						required: consumer.cost,
						available: 0,
					},
				};
			}

			const available = toFiniteNonNegativeInteger(pool.current);
			if (available < consumer.cost) {
				return {
					ok: false,
					failure: {
						code: 'insufficientCharges',
						poolIdentifier: consumer.poolIdentifier,
						poolLabel: pool.label,
						required: consumer.cost,
						available,
					},
				};
			}
		}

		return { ok: true };
	},

	async consumeOnResolvedItemUse(
		item: Item | null | undefined,
		context: ChargeContext = {},
	): Promise<ChargeValidationResult> {
		if (!item) return { ok: true };
		const ruleBackedItem = item as RuleBackedItem;
		const actor = item.actor;
		if (!isCharacterActor(actor)) return { ok: true };

		const currentPools = buildEffectiveChargePoolMap(actor);
		const consumers = getChargeConsumers(actor, ruleBackedItem);

		const consumption: ChargeConsumptionDetail[] = [];
		const consumptionByPoolId = new Map<string, ChargeConsumptionDetail>();
		const consumedPoolIds = new Set<string>();
		const nextPools = foundry.utils.deepClone(currentPools) as ChargePoolMap;
		const triggers = getApplicableUsageTriggers(context);

		// Apply consumption
		for (const consumer of consumers) {
			const pool = nextPools[consumer.poolId];
			if (!pool) {
				return {
					ok: false,
					failure: {
						code: 'poolMissing',
						poolIdentifier: consumer.poolIdentifier,
						poolLabel: consumer.poolIdentifier,
						required: consumer.cost,
						available: 0,
					},
				};
			}

			if (pool.current < consumer.cost) {
				return {
					ok: false,
					failure: {
						code: 'insufficientCharges',
						poolIdentifier: consumer.poolIdentifier,
						poolLabel: pool.label,
						required: consumer.cost,
						available: pool.current,
					},
				};
			}

			pool.current = clampCurrentToMax(pool.current - consumer.cost, pool.max);
			consumedPoolIds.add(consumer.poolId);
		}

		// Apply recovery
		const postRecoveryPools = applyRecoveryTriggersToPools(actor, nextPools, triggers);

		// Capture consumption details for directly consumed pools
		for (const poolId of consumedPoolIds) {
			const preConsumptionPool = currentPools[poolId];
			const postConsumptionPool = nextPools[poolId];
			const postRecoveryPool = postRecoveryPools[poolId];

			if (!preConsumptionPool || !postConsumptionPool || !postRecoveryPool) continue;

			// What we consumed: pre-consumption -> post-consumption
			const previousValue = preConsumptionPool.current;
			const currentValue = postConsumptionPool.current;
			const change = currentValue - previousValue;

			consumptionByPoolId.set(poolId, {
				poolLabel: postRecoveryPool.label,
				previousValue,
				currentValue,
				maxValue: postRecoveryPool.max,
				change,
			});
		}

		// Attach recovery details for all pools changed by recovery triggers, including
		// pools that were not directly consumed by this item use.
		for (const [poolId, postRecoveryPool] of Object.entries(postRecoveryPools)) {
			const postConsumptionPool = nextPools[poolId];
			if (!postConsumptionPool) continue;
			if (postConsumptionPool.current === postRecoveryPool.current) continue;

			const recovery: NonNullable<ChargeConsumptionDetail['recovery']> = {
				trigger: resolveRecoveryTrigger(postRecoveryPool, triggers),
				previousValue: postConsumptionPool.current,
				newValue: postRecoveryPool.current,
			};

			const existingEntry = consumptionByPoolId.get(poolId);
			if (existingEntry) {
				existingEntry.recovery = recovery;
				continue;
			}

			const preConsumptionPool = currentPools[poolId];
			const previousValue = preConsumptionPool?.current ?? postConsumptionPool.current;
			const currentValue = postConsumptionPool.current;
			const change = currentValue - previousValue;

			consumptionByPoolId.set(poolId, {
				poolLabel: postRecoveryPool.label,
				previousValue,
				currentValue,
				maxValue: postRecoveryPool.max,
				change,
				recovery,
			});
		}

		consumption.push(...consumptionByPoolId.values());

		if (!areChargePoolMapsEqual(currentPools, postRecoveryPools)) {
			await persistChargePoolMap(actor, postRecoveryPools);
		}

		return { ok: true, consumption };
	},

	async applyRestRecovery(
		actor: Actor | null | undefined,
		restType: ChargeRestType,
	): Promise<void> {
		if (!isCharacterActor(actor)) return;
		const trigger: ChargeRecoveryTrigger = restType === 'safe' ? 'safeRest' : 'fieldRest';

		const currentPools = buildEffectiveChargePoolMap(actor);
		const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [trigger]);
		if (areChargePoolMapsEqual(currentPools, nextPools)) return;

		await persistChargePoolMap(actor, nextPools);
	},

	async applyEncounterRecovery(
		actor: Actor | null | undefined,
		encounterTrigger: 'encounterStart' | 'encounterEnd',
	): Promise<void> {
		if (!isCharacterActor(actor)) return;

		const currentPools = buildEffectiveChargePoolMap(actor);
		const nextPools = applyRecoveryTriggersToPools(actor, currentPools, [encounterTrigger]);
		if (areChargePoolMapsEqual(currentPools, nextPools)) return;

		await persistChargePoolMap(actor, nextPools);
	},

	async adjustPool(
		actor: Actor | null | undefined,
		poolId: string,
		mode: ManualAdjustMode,
		value: number,
	): Promise<boolean> {
		if (!isCharacterActor(actor)) return false;
		if (typeof poolId !== 'string' || poolId.length < 1) return false;

		const currentPools = buildEffectiveChargePoolMap(actor);
		const pool = currentPools[poolId];
		if (!pool) return false;

		const normalizedValue = toFiniteNonNegativeInteger(value);
		if (mode === 'refresh') {
			pool.current = pool.max;
		} else if (mode === 'set') {
			pool.current = clampCurrentToMax(normalizedValue, pool.max);
		} else {
			pool.current = clampCurrentToMax(pool.current + normalizedValue, pool.max);
		}

		await persistChargePoolMap(actor, currentPools);
		return true;
	},
};

export { ChargePoolService };
