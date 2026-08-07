import { getActorDyingActionLimit, isActorDying } from '#utils/actorHealthState.js';
import { getAllHeroicReactionAvailabilityUpdate } from '#utils/heroicActions.js';
import type { CombatantBaseActions, NimbleCombatantSystem } from './combatTypes.js';

function getCombatantSystem(combatant: Combatant.Implementation): NimbleCombatantSystem | null {
	const system = combatant.system;
	if (!system || typeof system !== 'object') return null;
	return system as NimbleCombatantSystem;
}

function normalizeNonNegativeInteger(value: unknown): number {
	const normalized = Number(value ?? 0);
	if (!Number.isFinite(normalized)) return 0;
	return Math.max(0, Math.trunc(normalized));
}

export function getCombatantBaseActions(combatant: Combatant.Implementation): CombatantBaseActions {
	const actions = getCombatantSystem(combatant)?.actions?.base;
	return {
		current: normalizeNonNegativeInteger(actions?.current),
		max: normalizeNonNegativeInteger(actions?.max),
	};
}

export function getCombatantAdditionalActions(combatant: Combatant.Implementation): number {
	const actions = getCombatantSystem(combatant)?.actions?.base;
	return normalizeNonNegativeInteger((actions as { additional?: unknown } | undefined)?.additional);
}

export function isCombatantDying(combatant: Combatant.Implementation): boolean {
	return isActorDying(combatant.actor);
}

/**
 * Base action max to reset `current` to at the start of a turn, capped at the
 * actor's Dying action limit (baseline 1, raised by features such as Enduring
 * Rage) while the combatant is Dying.
 */
export function getCombatantResetActions(combatant: Combatant.Implementation): number {
	const baseMax = getCombatantBaseActionMax(combatant);
	if (isCombatantDying(combatant)) {
		return Math.min(baseMax, getActorDyingActionLimit(combatant.actor));
	}
	return baseMax;
}

export function getCombatantBaseActionCurrent(combatant: Combatant.Implementation): number {
	return getCombatantBaseActions(combatant).current;
}

export function getCombatantBaseActionMax(combatant: Combatant.Implementation): number {
	return getCombatantBaseActions(combatant).max;
}

export function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number(getCombatantSystem(combatant)?.sort ?? 0);
}

/**
 * The character combatant's pending action adjustment: an amount folded into
 * `current` at their next action refill, then zeroed. May be negative (an
 * action debt owed to the next turn). Always 0 for non-character combatants,
 * whose models don't carry the field.
 */
export function getCombatantPendingActionDelta(combatant: Combatant.Implementation): number {
	if (combatant.type !== 'character') return 0;
	const actions = getCombatantSystem(combatant)?.actions as
		| { pendingDelta?: unknown }
		| undefined
		| null;
	const normalized = Number(actions?.pendingDelta ?? 0);
	if (!Number.isFinite(normalized)) return 0;
	return Math.trunc(normalized);
}

/**
 * The update object that refills a character combatant's turn state: base
 * actions reset to max (capped by Dying) with any pending action adjustment
 * folded in and cleared, additional actions cleared, and heroic reactions
 * restored. Shared by every character `current`-reset site so the refill
 * semantics can never drift between them.
 */
export function buildCharacterTurnRefillUpdate(
	combatant: Combatant.Implementation,
): Record<string, unknown> {
	const pendingDelta = getCombatantPendingActionDelta(combatant);
	return {
		'system.actions.base.current': Math.max(0, getCombatantResetActions(combatant) + pendingDelta),
		'system.actions.base.additional': 0,
		'system.actions.pendingDelta': 0,
		...getAllHeroicReactionAvailabilityUpdate(true),
	};
}
