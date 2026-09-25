import { summariseMovementHistory } from './summariseMovementHistory.js';

interface CombatantLike {
	actorId: string | null;
	tokenId: string | null;
	sceneId: string | null;
	token: {
		actorLink?: boolean;
		parent?: { id?: string | null; grid?: { measurePath?: unknown } | null } | null;
		movementHistory: { action: string }[];
	} | null;
}

interface CombatLike {
	started?: boolean;
	combatants?: Iterable<CombatantLike>;
}

interface ActorLike {
	id: string | null;
	isToken?: boolean;
	token?: { id: string | null; parent?: { id?: string | null } | null } | null;
}

// Matched by id: reading `combatant.actor` here would build a synthetic token
// actor while that same actor is being prepared, which never ends.
function isCombatantFor(combatant: CombatantLike, actor: ActorLike): boolean {
	if (actor.isToken) {
		const token = actor.token;
		if (!token) return false;
		return combatant.tokenId === token.id && combatant.sceneId === (token.parent?.id ?? null);
	}
	return combatant.actorId === actor.id && combatant.token?.actorLink !== false;
}

/**
 * Spaces Moved This Turn for an actor, read from its combatant token's movement
 * history in whichever started combat holds it. Null when the actor is not a
 * combatant in a started combat, because Foundry records no history outside
 * one, and null while the token's scene has no grid to measure with yet.
 */
export function getSpacesMovedThisTurn(actor: ActorLike): number | null {
	const combats = (game.combats ?? []) as Iterable<CombatLike>;
	for (const combat of combats) {
		if (!combat.started || !combat.combatants) continue;
		for (const combatant of combat.combatants) {
			if (!isCombatantFor(combatant, actor)) continue;
			const token = combatant.token;
			if (!token || typeof token.parent?.grid?.measurePath !== 'function') return null;
			return summariseMovementHistory(
				token as unknown as Parameters<typeof summariseMovementHistory>[0],
				token.movementHistory,
			).counted;
		}
	}
	return null;
}
