import type { TurnIdentity } from '../documents/combat/combatTypes.js';
import {
	getExpandedTurnIdentityHint,
	getPersistedExpandedTurnIdentity,
	setExpandedTurnIdentityHint,
} from '../documents/combat/expandedTurnIdentityStore.js';

type CombatWithTurnIdentityHint = Combat & {
	_nimbleExpandedTurnIdentity?: TurnIdentity | null;
};

function resolveCurrentTurnIdentity(
	combat: Combat,
	existingTurns: Combatant.Implementation[],
): TurnIdentity | null {
	const combatWithHint = combat as CombatWithTurnIdentityHint;
	const persistedTurnIdentity = getPersistedExpandedTurnIdentity(combat);
	if (persistedTurnIdentity) return persistedTurnIdentity;

	if (combatWithHint._nimbleExpandedTurnIdentity) {
		return combatWithHint._nimbleExpandedTurnIdentity;
	}

	const storedTurnIdentity = getExpandedTurnIdentityHint(combat.id ?? null);
	if (storedTurnIdentity) return storedTurnIdentity;

	const normalizedCurrentTurn =
		typeof combat.turn === 'number' && combat.turn >= 0 && combat.turn < existingTurns.length
			? combat.turn
			: null;
	const indexedCombatantId =
		normalizedCurrentTurn !== null ? getCombatantId(existingTurns[normalizedCurrentTurn]) : '';
	if (indexedCombatantId && normalizedCurrentTurn !== null) {
		return {
			combatantId: indexedCombatantId,
			occurrence: getCombatantOccurrenceAtIndex(
				existingTurns,
				indexedCombatantId,
				normalizedCurrentTurn,
			),
		};
	}

	const explicitCombatantId = getCombatantId(combat.combatant);
	if (explicitCombatantId) {
		return { combatantId: explicitCombatantId, occurrence: null };
	}

	return null;
}

export function getCombatantId(
	combatant: { id?: string | null; _id?: string | null } | null | undefined,
): string {
	return combatant?.id ?? combatant?._id ?? '';
}

export function getCombatantOccurrenceAtIndex(
	combatants: Combatant.Implementation[],
	combatantId: string,
	inclusiveIndex: number,
): number {
	let occurrence = -1;
	for (let index = 0; index <= inclusiveIndex && index < combatants.length; index += 1) {
		const id = getCombatantId(combatants[index]);
		if (id === combatantId) occurrence += 1;
	}
	return occurrence;
}

export function findTurnIndexByOccurrence(
	turns: Combatant.Implementation[],
	combatantId: string,
	desiredOccurrence: number | null,
): number {
	let occurrence = -1;
	for (const [index, turnCombatant] of turns.entries()) {
		if (getCombatantId(turnCombatant) !== combatantId) continue;
		occurrence += 1;
		if (desiredOccurrence === null || occurrence === desiredOccurrence) return index;
	}
	return -1;
}

export function syncCombatTurns(combat: Combat | null): void {
	if (!combat) return;

	const existingTurns = combat.turns;
	const combatWithHint = combat as CombatWithTurnIdentityHint;
	const currentTurnIdentity = resolveCurrentTurnIdentity(combat, existingTurns);

	let normalizedTurns: Combatant.Implementation[];
	try {
		normalizedTurns = combat.setupTurns();
	} catch (_error) {
		return;
	}

	combat.turns = normalizedTurns;
	if (normalizedTurns.length === 0) {
		combat.turn = 0;
		combatWithHint._nimbleExpandedTurnIdentity = null;
		setExpandedTurnIdentityHint(combat.id ?? null, null);
		return;
	}

	if (currentTurnIdentity?.combatantId) {
		const matchedIndex = findTurnIndexByOccurrence(
			normalizedTurns,
			currentTurnIdentity.combatantId,
			currentTurnIdentity.occurrence,
		);
		if (matchedIndex >= 0) {
			combat.turn = matchedIndex;
			combatWithHint._nimbleExpandedTurnIdentity = {
				combatantId: currentTurnIdentity.combatantId,
				occurrence: getCombatantOccurrenceAtIndex(
					normalizedTurns,
					currentTurnIdentity.combatantId,
					matchedIndex,
				),
			};
			setExpandedTurnIdentityHint(combat.id ?? null, combatWithHint._nimbleExpandedTurnIdentity);
			return;
		}
	}

	const fallbackTurn = Number.isInteger(combat.turn) ? Number(combat.turn) : 0;
	combat.turn = Math.min(Math.max(fallbackTurn, 0), normalizedTurns.length - 1);
	const fallbackCombatantId = getCombatantId(normalizedTurns[combat.turn]);
	combatWithHint._nimbleExpandedTurnIdentity = fallbackCombatantId
		? {
				combatantId: fallbackCombatantId,
				occurrence: getCombatantOccurrenceAtIndex(
					normalizedTurns,
					fallbackCombatantId,
					combat.turn,
				),
			}
		: null;
	setExpandedTurnIdentityHint(combat.id ?? null, combatWithHint._nimbleExpandedTurnIdentity);
}

export function getActiveCombatantId(combat: Combat | null): string | null {
	if (!combat) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (Number.isInteger(turnIndex) && turnIndex >= 0 && turnIndex < combat.turns.length) {
		return combat.turns[turnIndex]?.id ?? null;
	}
	return combat.combatant?.id ?? null;
}

export function getActiveCombatant(combat: Combat | null): Combatant.Implementation | null {
	if (!combat) return null;
	const activeId = getActiveCombatantId(combat);
	if (!activeId) return null;
	return (
		combat.combatants.get(activeId) ??
		combat.turns.find((turnCombatant) => turnCombatant.id === activeId) ??
		null
	);
}

export function getActiveCombatantOccurrence(
	combat: Combat | null,
	activeId: string,
): number | null {
	if (!combat) return null;
	const turnIndex = Number(combat.turn ?? -1);
	if (!Number.isInteger(turnIndex) || turnIndex < 0 || turnIndex >= combat.turns.length)
		return null;
	return getCombatantOccurrenceAtIndex(combat.turns, activeId, turnIndex);
}
