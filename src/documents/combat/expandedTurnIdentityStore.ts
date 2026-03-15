import type { TurnIdentity } from './combatTypes.js';

const expandedTurnIdentityByCombatId = new Map<string, TurnIdentity>();
export const EXPANDED_TURN_IDENTITY_FLAG_PATH = 'flags.nimble.expandedTurnIdentity';

function normalizeTurnIdentity(value: unknown): TurnIdentity | null {
	if (!value || typeof value !== 'object') return null;

	const combatantId = foundry.utils.getProperty(value, 'combatantId');
	if (typeof combatantId !== 'string' || combatantId.length < 1) return null;

	const occurrence = foundry.utils.getProperty(value, 'occurrence');
	if (occurrence != null && !Number.isInteger(occurrence)) return null;

	return {
		combatantId,
		occurrence: occurrence == null ? null : Number(occurrence),
	};
}

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

export function getPersistedExpandedTurnIdentity(target: unknown): TurnIdentity | null {
	if (!target || typeof target !== 'object') return null;
	return normalizeTurnIdentity(foundry.utils.getProperty(target, EXPANDED_TURN_IDENTITY_FLAG_PATH));
}

export function buildExpandedTurnIdentityUpdate(
	turnIdentity: TurnIdentity | null,
): Record<string, TurnIdentity | null> {
	return {
		[EXPANDED_TURN_IDENTITY_FLAG_PATH]: turnIdentity,
	};
}

export function areTurnIdentitiesEqual(
	left: TurnIdentity | null | undefined,
	right: TurnIdentity | null | undefined,
): boolean {
	return (
		(left?.combatantId ?? null) === (right?.combatantId ?? null) &&
		(left?.occurrence ?? null) === (right?.occurrence ?? null)
	);
}
