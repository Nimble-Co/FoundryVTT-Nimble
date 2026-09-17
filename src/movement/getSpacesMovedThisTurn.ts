import { summariseMovementHistory } from './summariseMovementHistory.js';

interface CombatantLike {
	actor: unknown;
	token: { movementHistory: { action: string }[] } | null;
}

/**
 * Spaces Moved This Turn for an actor, read from its combatant token's movement
 * history. Null when the actor is not a combatant in a started combat, because
 * Foundry records no history outside one.
 */
export function getSpacesMovedThisTurn(actor: unknown): number | null {
	const combat = game.combat as { started?: boolean; combatants?: Iterable<CombatantLike> } | null;
	if (!combat?.started || !combat.combatants) return null;

	let token: CombatantLike['token'] = null;
	for (const combatant of combat.combatants) {
		if (combatant.actor === actor) {
			token = combatant.token;
			break;
		}
	}
	if (!token) return null;

	return summariseMovementHistory(
		token as unknown as Parameters<typeof summariseMovementHistory>[0],
		token.movementHistory,
	).counted;
}
