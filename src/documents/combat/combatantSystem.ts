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

export function getCombatantBaseActionCurrent(combatant: Combatant.Implementation): number {
	return getCombatantBaseActions(combatant).current;
}

export function getCombatantBaseActionMax(combatant: Combatant.Implementation): number {
	return getCombatantBaseActions(combatant).max;
}

export function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	return Number(getCombatantSystem(combatant)?.sort ?? 0);
}
