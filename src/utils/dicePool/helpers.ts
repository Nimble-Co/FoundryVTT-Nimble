import type { NimbleRollData } from '#types/rollData.d.ts';
import getDeterministicBonus from '../../dice/getDeterministicBonus.js';
import { DicePoolRuleConfig } from './dicePoolRuleConfig.js';
import type {
	CharacterActorLike,
	DicePoolDefinition,
	DicePoolInitialMode,
	DicePoolMap,
	DicePoolRuleLike,
	DicePoolScope,
	DicePoolState,
	DiceRefillEntry,
	DiceRefillMode,
	DiceRefillTrigger,
	DieSize,
	ModifyPoolRuleLike,
	NumericInput,
	RuleBackedItem,
} from './types.js';

const VALID_REFILL_TRIGGERS: Set<DiceRefillTrigger> = new Set(DicePoolRuleConfig.refillTriggers);
const VALID_REFILL_MODES: Set<DiceRefillMode> = new Set(DicePoolRuleConfig.refillModes);
const VALID_DIE_SIZES: Set<DieSize> = new Set(DicePoolRuleConfig.dieSizes);
const DEFAULT_DIE_SIZE: DieSize = 'd4';

function isCharacterActor(actor: Actor | null | undefined): actor is CharacterActorLike {
	return actor?.type === 'character';
}

function toFiniteNonNegativeInteger(value: NumericInput): number {
	const numericValue = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.max(0, Math.floor(numericValue));
}

function toFiniteInteger(value: NumericInput): number {
	const numericValue = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(numericValue)) return 0;
	return Math.trunc(numericValue);
}

function toNumericInput(value: unknown): NumericInput {
	if (typeof value === 'number' || typeof value === 'string') return value;
	if (value === null || value === undefined) return value;
	return undefined;
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

function buildDicePoolId(
	scope: DicePoolScope,
	identifier: string,
	_poolSourceItemId: string,
): string {
	if (scope === 'actor') {
		return `actor:${identifier}`;
	}

	return identifier;
}

function toDicePoolScope(value: unknown): DicePoolScope {
	return value === 'actor' ? 'actor' : 'item';
}

function toDieSize(value: unknown, fallback: DieSize = DEFAULT_DIE_SIZE): DieSize {
	if (typeof value !== 'string') return fallback;
	const trimmed = value.trim() as DieSize;
	if (VALID_DIE_SIZES.has(trimmed)) return trimmed;
	return fallback;
}

function dieSizeToMaxFace(dieSize: DieSize): number {
	return Number(dieSize.slice(1));
}

function resolveFormulaToInteger(actor: CharacterActorLike, formula: unknown): number {
	if (typeof formula !== 'string' || formula.trim().length < 1) return 0;
	const resolvedValue = getDeterministicBonus(formula, actor.getRollData() as NimbleRollData);
	return toFiniteNonNegativeInteger(resolvedValue);
}

function resolveSignedFormulaToInteger(actor: CharacterActorLike, formula: unknown): number {
	if (typeof formula !== 'string' || formula.trim().length < 1) return 0;
	const resolvedValue = getDeterministicBonus(formula, actor.getRollData() as NimbleRollData);
	return toFiniteInteger(resolvedValue);
}

function normalizeRefills(value: unknown): DiceRefillEntry[] {
	if (!Array.isArray(value)) return [];

	const refills: DiceRefillEntry[] = [];
	for (const entry of value) {
		if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
		const sourceEntry = entry as Record<string, unknown>;
		const trigger = sourceEntry.trigger;
		if (typeof trigger !== 'string' || !VALID_REFILL_TRIGGERS.has(trigger as DiceRefillTrigger)) {
			continue;
		}

		const modeValue = sourceEntry.mode;
		const mode = VALID_REFILL_MODES.has(modeValue as DiceRefillMode)
			? (modeValue as DiceRefillMode)
			: 'add';
		const formula = typeof sourceEntry.value === 'string' ? sourceEntry.value : '1';

		refills.push({
			trigger: trigger as DiceRefillTrigger,
			mode,
			value: formula,
		});
	}

	return refills;
}

function normalizeFaces(value: unknown, dieSize: DieSize, max: number): number[] {
	if (!Array.isArray(value)) return [];
	const maxFace = dieSizeToMaxFace(dieSize);
	const faces: number[] = [];
	for (const entry of value) {
		const face = typeof entry === 'number' ? entry : Number(entry);
		if (!Number.isFinite(face)) continue;
		const clamped = Math.max(1, Math.min(maxFace, Math.floor(face)));
		faces.push(clamped);
		if (faces.length >= max) break;
	}
	return faces;
}

function getDicePoolMapFromActor(actor: CharacterActorLike): DicePoolMap {
	const normalizedRecord: DicePoolMap = {};

	const rawActorPools = foundry.utils.getProperty(actor, DicePoolRuleConfig.flagPath);
	if (rawActorPools && typeof rawActorPools === 'object' && !Array.isArray(rawActorPools)) {
		const sourceRecord = rawActorPools as Record<string, unknown>;
		for (const [poolId, poolValue] of Object.entries(sourceRecord)) {
			if (!poolValue || typeof poolValue !== 'object' || Array.isArray(poolValue)) continue;
			if (!poolId.startsWith('actor:')) continue;

			const sourcePool = poolValue as Record<string, unknown>;
			const max = toFiniteNonNegativeInteger(toNumericInput(sourcePool.max));
			const dieSize = toDieSize(sourcePool.dieSize);
			const faces = normalizeFaces(sourcePool.faces, dieSize, max);

			const refills = normalizeRefills(sourcePool.refills);
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
				dieSize,
				max,
				faces,
				icon: normalizeIcon(sourcePool.icon),
				refills,
			};
		}
	}

	for (const item of actor.items.contents) {
		const itemFlags = item.flags as Record<string, unknown>;
		const nimbleFlags = itemFlags.nimble;
		if (!nimbleFlags || typeof nimbleFlags !== 'object' || Array.isArray(nimbleFlags)) continue;
		const dicePoolsOnItem = (nimbleFlags as Record<string, unknown>).dicePools;
		if (!dicePoolsOnItem || typeof dicePoolsOnItem !== 'object' || Array.isArray(dicePoolsOnItem)) {
			continue;
		}

		const itemPoolRecord = dicePoolsOnItem as Record<string, unknown>;
		for (const [poolIdentifier, poolValue] of Object.entries(itemPoolRecord)) {
			if (!poolValue || typeof poolValue !== 'object' || Array.isArray(poolValue)) continue;

			const sourcePool = poolValue as Record<string, unknown>;
			const max = toFiniteNonNegativeInteger(toNumericInput(sourcePool.max));
			const dieSize = toDieSize(sourcePool.dieSize);
			const faces = normalizeFaces(sourcePool.faces, dieSize, max);
			const refills = normalizeRefills(sourcePool.refills);
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
				dieSize,
				max,
				faces,
				icon: normalizeIcon(sourcePool.icon),
				refills,
			};
		}
	}

	return normalizedRecord;
}

function getDicePoolModifiers(actor: CharacterActorLike): Map<string, ModifyPoolRuleLike[]> {
	const modifiersByIdentifier = new Map<string, ModifyPoolRuleLike[]>();

	for (const item of actor.items.contents) {
		const ruleBackedItem = item as RuleBackedItem;
		const rules = ruleBackedItem.rules;
		if (!rules) continue;

		for (const rule of rules.values()) {
			if (rule.type !== 'modifyPool' || rule.disabled) continue;
			const modifier = rule as ModifyPoolRuleLike;
			if (modifier.poolType !== 'dice') continue;
			// Respect the rule's predicate (e.g. level: { min: 6 } gating).
			const ruleWithApplies = rule as { appliesTo?: () => boolean };
			if (typeof ruleWithApplies.appliesTo === 'function' && !ruleWithApplies.appliesTo()) continue;
			const poolIdentifier = normalizeIdentifier(modifier.poolIdentifier);
			if (poolIdentifier.length < 1) continue;

			const existing = modifiersByIdentifier.get(poolIdentifier) ?? [];
			existing.push(modifier);
			modifiersByIdentifier.set(poolIdentifier, existing);
		}
	}

	// Stable sort by rule priority so later-priority modifiers override earlier ones.
	for (const list of modifiersByIdentifier.values()) {
		list.sort(
			(a, b) =>
				((a as { priority?: number }).priority ?? 0) - ((b as { priority?: number }).priority ?? 0),
		);
	}

	return modifiersByIdentifier;
}

function applyModifiersToDefinition(
	actor: CharacterActorLike,
	definition: DicePoolDefinition,
	modifiers: ModifyPoolRuleLike[] | undefined,
): DicePoolDefinition {
	if (!modifiers || modifiers.length < 1) return definition;

	let dieSize = definition.dieSize;
	let max = definition.max;

	for (const modifier of modifiers) {
		if (typeof modifier.dieSize === 'string' && modifier.dieSize.trim().length > 0) {
			dieSize = toDieSize(modifier.dieSize, dieSize);
		}
		if (typeof modifier.maxDelta === 'string' && modifier.maxDelta.trim().length > 0) {
			max = Math.max(0, max + resolveSignedFormulaToInteger(actor, modifier.maxDelta));
		}
	}

	return { ...definition, dieSize, max };
}

function getDicePoolDefinitions(actor: CharacterActorLike): DicePoolDefinition[] {
	const definitions: DicePoolDefinition[] = [];
	const modifiersByIdentifier = getDicePoolModifiers(actor);

	for (const item of actor.items.contents) {
		const ruleBackedItem = item as RuleBackedItem;
		const rules = ruleBackedItem.rules;
		if (!rules) continue;
		const sourceItemId = normalizeIdentifier(item.id);
		if (sourceItemId.length < 1) continue;

		for (const rule of rules.values()) {
			if (rule.type !== 'dicePool' || rule.disabled) continue;
			const poolRule = rule as DicePoolRuleLike;
			const identifier = normalizeIdentifier(poolRule.identifier || poolRule.id);
			if (identifier.length < 1) continue;

			const scope = toDicePoolScope(poolRule.scope);
			const dieSize = toDieSize(poolRule.dieSize);
			const max = resolveFormulaToInteger(actor, poolRule.max);
			const id = buildDicePoolId(scope, identifier, sourceItemId);
			const initial: DicePoolInitialMode = poolRule.initial === 'zero' ? 'zero' : 'max';
			const refills = normalizeRefills(poolRule.refills);

			const baseDefinition: DicePoolDefinition = {
				id,
				identifier,
				scope,
				sourceItemId,
				sourceItemName: item.name,
				label: normalizeIdentifier(poolRule.label) || item.name || identifier,
				dieSize,
				max,
				icon: normalizeIcon(poolRule.icon),
				initial,
				refills,
			};

			definitions.push(
				applyModifiersToDefinition(actor, baseDefinition, modifiersByIdentifier.get(identifier)),
			);
		}
	}

	return definitions;
}

/**
 * Roll a single die of the given size and return its face value.
 * Uses Foundry's randomID-style synchronous evaluation via a Roll.
 */
async function rollSingleDieFace(dieSize: DieSize): Promise<number> {
	const RollCls = (
		foundry as unknown as {
			dice: {
				terms: {
					Die: new (config: { faces: number }) => { evaluate: () => Promise<void>; total: number };
				};
			};
		}
	).dice?.terms?.Die;
	if (RollCls) {
		const die = new RollCls({ faces: dieSizeToMaxFace(dieSize) });
		await die.evaluate();
		return die.total;
	}

	// Fallback for environments without Foundry Roll terms (tests)
	const faces = dieSizeToMaxFace(dieSize);
	return 1 + Math.floor(Math.random() * faces);
}

/**
 * Build a fresh DicePoolState for a definition (used for initial seeding).
 * If initial === 'max', pre-rolls `max` dice. If 'zero', leaves faces empty.
 */
async function buildInitialDicePoolState(definition: DicePoolDefinition): Promise<DicePoolState> {
	const faces: number[] = [];
	if (definition.initial === 'max') {
		for (let index = 0; index < definition.max; index += 1) {
			faces.push(await rollSingleDieFace(definition.dieSize));
		}
	}

	return {
		id: definition.id,
		identifier: definition.identifier,
		scope: definition.scope,
		sourceItemId: definition.sourceItemId,
		sourceItemName: definition.sourceItemName,
		label: definition.label,
		dieSize: definition.dieSize,
		max: definition.max,
		faces,
		icon: definition.icon,
		refills: definition.refills,
	};
}

/**
 * Reconcile existing pool state with the (possibly modified) definition.
 *
 * Behavior:
 *  - If `max` shrank: truncate `faces[]` from the end.
 *  - If `dieSize` changed: leave existing faces as-is (they were rolled on the old size;
 *    next refill will use the new size). This matches the design call — mid-pool
 *    dieSize changes are rare and the pool typically wipes between scenes anyway.
 *  - All other definition fields are taken from the (modified) definition.
 *
 * This is a synchronous shape-only reconciler — it does NOT roll new dice.
 * Refills happen via dicePoolRefill triggers.
 */
function reconcileDicePoolState(
	existing: DicePoolState | undefined,
	definition: DicePoolDefinition,
): DicePoolState {
	const faces = existing?.faces ?? [];
	const clampedFaces = faces.length > definition.max ? faces.slice(0, definition.max) : faces;

	return {
		id: definition.id,
		identifier: definition.identifier,
		scope: definition.scope,
		sourceItemId: definition.sourceItemId,
		sourceItemName: definition.sourceItemName,
		label: definition.label,
		dieSize: definition.dieSize,
		max: definition.max,
		faces: [...clampedFaces],
		icon: existing?.icon ?? definition.icon,
		refills: definition.refills,
	};
}

/**
 * Build the effective dicePool map for an actor by reconciling existing flag
 * state with current rule definitions. Does NOT roll new dice — that's the
 * refill subsystem's job.
 */
function buildEffectiveDicePoolMap(actor: CharacterActorLike): DicePoolMap {
	const existingPools = getDicePoolMapFromActor(actor);
	const definitions = getDicePoolDefinitions(actor);
	const nextPools: DicePoolMap = {};

	for (const definition of definitions) {
		const existingPool = existingPools[definition.id];
		nextPools[definition.id] = reconcileDicePoolState(existingPool, definition);
	}

	return nextPools;
}

function buildPoolUpdatePayload(
	existingPools: Record<string, unknown>,
	nextPools: Record<string, DicePoolState>,
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

async function persistDicePoolMap(actor: CharacterActorLike, pools: DicePoolMap): Promise<void> {
	const itemScopedPools: Record<string, DicePoolState> = {};
	const actorScopedPools: Record<string, DicePoolState> = {};

	for (const [poolId, poolState] of Object.entries(pools)) {
		if (poolId.startsWith('actor:')) {
			actorScopedPools[poolId] = poolState;
		} else {
			itemScopedPools[poolId] = poolState;
		}
	}

	const updates: Promise<unknown>[] = [];
	const itemPoolsByItemId = new Map<string, Record<string, DicePoolState>>();

	for (const [, poolState] of Object.entries(itemScopedPools)) {
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
			(foundry.utils.getProperty(item, DicePoolRuleConfig.flagPath) as Record<string, unknown>) ??
			{};
		const itemPoolUpdatePayload = buildPoolUpdatePayload(existingItemPools, poolsToUpdate);
		if (Object.keys(itemPoolUpdatePayload).length < 1) continue;

		updates.push(
			item.update(
				{
					'flags.nimble.dicePools': itemPoolUpdatePayload,
				} as Record<string, unknown>,
				{
					nimble: {
						skipDicePoolSync: true,
					},
				} as Record<string, unknown>,
			),
		);
	}

	const existingActorPools =
		(foundry.utils.getProperty(actor, DicePoolRuleConfig.flagPath) as Record<string, unknown>) ??
		{};
	const actorPoolUpdatePayload = buildPoolUpdatePayload(existingActorPools, actorScopedPools);
	if (Object.keys(actorPoolUpdatePayload).length > 0) {
		updates.push(
			actor.update(
				{
					[DicePoolRuleConfig.flagPath]: actorPoolUpdatePayload,
				} as Record<string, unknown>,
				{
					nimble: {
						skipDicePoolSync: true,
					},
				} as Record<string, unknown>,
			),
		);
	}

	await Promise.all(updates);
}

function areRefillEntriesEqual(left: DiceRefillEntry[], right: DiceRefillEntry[]): boolean {
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

function areFaceArraysEqual(left: number[], right: number[]): boolean {
	if (left.length !== right.length) return false;
	for (let index = 0; index < left.length; index += 1) {
		if (left[index] !== right[index]) return false;
	}
	return true;
}

function areDicePoolStatesEqual(left: DicePoolState, right: DicePoolState): boolean {
	return (
		left.id === right.id &&
		left.identifier === right.identifier &&
		left.scope === right.scope &&
		left.sourceItemId === right.sourceItemId &&
		left.sourceItemName === right.sourceItemName &&
		left.label === right.label &&
		left.dieSize === right.dieSize &&
		left.max === right.max &&
		left.icon === right.icon &&
		areFaceArraysEqual(left.faces, right.faces) &&
		areRefillEntriesEqual(left.refills, right.refills)
	);
}

function areDicePoolMapsEqual(left: DicePoolMap, right: DicePoolMap): boolean {
	const leftIds = Object.keys(left).sort();
	const rightIds = Object.keys(right).sort();
	if (leftIds.length !== rightIds.length) return false;

	for (let index = 0; index < leftIds.length; index += 1) {
		if (leftIds[index] !== rightIds[index]) return false;
		const poolId = leftIds[index];
		const leftPool = left[poolId];
		const rightPool = right[poolId];
		if (!rightPool) return false;
		if (!areDicePoolStatesEqual(leftPool, rightPool)) return false;
	}

	return true;
}

export {
	DEFAULT_DIE_SIZE,
	VALID_DIE_SIZES,
	VALID_REFILL_MODES,
	VALID_REFILL_TRIGGERS,
	applyModifiersToDefinition,
	areDicePoolMapsEqual,
	areDicePoolStatesEqual,
	areFaceArraysEqual,
	areRefillEntriesEqual,
	buildDicePoolId,
	buildEffectiveDicePoolMap,
	buildInitialDicePoolState,
	buildPoolUpdatePayload,
	dieSizeToMaxFace,
	getDicePoolDefinitions,
	getDicePoolMapFromActor,
	getDicePoolModifiers,
	isCharacterActor,
	normalizeFaces,
	normalizeIcon,
	normalizeIdentifier,
	normalizeRefills,
	persistDicePoolMap,
	reconcileDicePoolState,
	resolveFormulaToInteger,
	resolveSignedFormulaToInteger,
	rollSingleDieFace,
	toDicePoolScope,
	toDieSize,
	toFiniteInteger,
	toFiniteNonNegativeInteger,
	toNumericInput,
};
