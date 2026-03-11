import localize from './localize.js';

/**
 * Get currently targeted tokens, excluding tokens belonging to the specified actor.
 * @param actorId - The actor ID to exclude (typically the acting character)
 * @returns Array of targeted tokens that don't belong to the specified actor
 */
export function getTargetedTokens(actorId: string): Token[] {
	const targets = Array.from(game.user?.targets ?? []);
	return targets.filter((token) => token.actor?.id !== actorId);
}

/**
 * Get currently targeted tokens that belong to the specified actor (self-targeting).
 * @param actorId - The actor ID to check for
 * @returns Array of targeted tokens that belong to the specified actor
 */
export function getInvalidTargets(actorId: string): Token[] {
	const targets = Array.from(game.user?.targets ?? []);
	return targets.filter((token) => token.actor?.id === actorId);
}

/**
 * Get the display name for a token.
 * @param token - The token to get the name from
 * @returns The token's actor name, token name, or localized "Unknown" fallback
 */
export function getTargetName(token: Token | null | undefined): string {
	return token?.actor?.name || token?.name || localize('NIMBLE.ui.heroicActions.unknown');
}
