import { summariseMovementHistory } from './summariseMovementHistory.js';

interface CombatantLike {
	actor: unknown;
	token: { movementHistory: { action: string }[] } | null;
}

interface CombatLike {
	started?: boolean;
	combatants?: Iterable<CombatantLike>;
}

/**
 * Spaces Moved This Turn for an actor, read from its combatant token's movement
 * history in whichever started combat holds it. Null when the actor is not a
 * combatant in a started combat, because Foundry records no history outside one.
 */
export function getSpacesMovedThisTurn(actor: unknown): number | null {
	const combats = (game.combats ?? []) as Iterable<CombatLike>;
	for (const combat of combats) {
		if (!combat.started || !combat.combatants) continue;
		for (const combatant of combat.combatants) {
			if (combatant.actor !== actor || !combatant.token) continue;
			return summariseMovementHistory(
				combatant.token as unknown as Parameters<typeof summariseMovementHistory>[0],
				combatant.token.movementHistory,
			).counted;
		}
	}
	return null;
}
