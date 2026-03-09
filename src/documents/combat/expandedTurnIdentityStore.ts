import type { TurnIdentity } from './combatTypes.js';

const expandedTurnIdentityByCombatId = new Map<string, TurnIdentity>();

export function getExpandedTurnIdentityHint(
	combatId: string | null | undefined,
): TurnIdentity | null {
	if (!combatId) return null;
	return expandedTurnIdentityByCombatId.get(combatId) ?? null;
}

export function setExpandedTurnIdentityHint(
	combatId: string | null | undefined,
	turnIdentity: TurnIdentity | null,
): void {
	if (!combatId) return;
	if (!turnIdentity) {
		expandedTurnIdentityByCombatId.delete(combatId);
		return;
	}
	expandedTurnIdentityByCombatId.set(combatId, turnIdentity);
}

export function clearExpandedTurnIdentityHint(combatId: string | null | undefined): void {
	if (!combatId) return;
	expandedTurnIdentityByCombatId.delete(combatId);
}
