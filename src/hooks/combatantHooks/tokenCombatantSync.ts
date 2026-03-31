/**
 * Token-Combatant Sync
 *
 * When a token is deleted from the scene, any corresponding combatants in active
 * combats should also be removed. This keeps the combat tracker in sync with
 * the scene canvas.
 */
let didRegisterTokenCombatantSync = false;

function getCombatantsForToken(
	tokenId: string,
	sceneId: string,
): Array<{ combat: Combat; combatant: Combatant.Implementation }> {
	const entries: Array<{ combat: Combat; combatant: Combatant.Implementation }> = [];

	for (const combat of game.combats?.contents ?? []) {
		for (const combatant of combat.combatants.contents) {
			if (combatant.tokenId === tokenId && combatant.sceneId === sceneId) {
				entries.push({ combat, combatant });
			}
		}
	}

	return entries;
}

async function removeOrphanedCombatants(tokenId: string, sceneId: string): Promise<void> {
	if (!game.user?.isGM) return;

	const matches = getCombatantsForToken(tokenId, sceneId);
	if (matches.length === 0) return;

	const deletionsByCombat = new Map<string, { combat: Combat; combatantIds: string[] }>();

	for (const { combat, combatant } of matches) {
		if (!combat.id || !combatant.id) continue;

		if (!deletionsByCombat.has(combat.id)) {
			deletionsByCombat.set(combat.id, { combat, combatantIds: [] });
		}
		deletionsByCombat.get(combat.id)?.combatantIds.push(combatant.id);
	}

	for (const { combat, combatantIds } of deletionsByCombat.values()) {
		if (combatantIds.length > 0) {
			await combat.deleteEmbeddedDocuments('Combatant', combatantIds);
		}
	}
}

export default function registerTokenCombatantSync() {
	if (didRegisterTokenCombatantSync) return;
	didRegisterTokenCombatantSync = true;

	Hooks.on('deleteToken', (token: TokenDocument) => {
		const tokenId = token.id;
		const sceneId = token.parent?.id;

		if (!tokenId || !sceneId) return;

		void removeOrphanedCombatants(tokenId, sceneId);
	});
}
