/**
 * Whether a token reads as defeated.
 *
 * Defeat sync mirrors the state onto the actor as the DEFEATED special status
 * effect on both the in-combat and out-of-combat paths, so the status is the
 * one marker that answers this without needing a combatant to exist.
 */
export default function isTokenDefeated(token: Token): boolean {
	const statuses = token.actor?.statuses;
	if (!(statuses instanceof Set)) return false;

	const defeatedStatus = CONFIG.specialStatusEffects?.DEFEATED;
	return !!defeatedStatus && statuses.has(defeatedStatus);
}
