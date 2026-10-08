interface CombatantTokenLike {
	id: string | null;
	parent?: { id?: string | null } | null;
}

export interface CombatLike {
	started?: boolean;
	combatants?: Iterable<{ tokenId: string | null; sceneId: string | null }>;
}

/**
 * Whether the token is a combatant in any started combat, not only the one
 * this client views: the active GM may be looking at another scene.
 */
export function isInStartedCombat(
	token: CombatantTokenLike,
	combats: Iterable<CombatLike> = (game.combats ?? []) as Iterable<CombatLike>,
): boolean {
	const sceneId = token.parent?.id ?? null;
	for (const combat of combats) {
		if (!combat.started || !combat.combatants) continue;
		for (const combatant of combat.combatants) {
			if (combatant.tokenId === token.id && combatant.sceneId === sceneId) return true;
		}
	}
	return false;
}
