export function getCombatantImage(
	combatant: Combatant.Implementation,
	options: { includeActorImage?: boolean; fallback?: string | null } = {},
): string | null {
	const tokenTextureSource = (combatant.token as unknown as { texture?: { src?: string } } | null)
		?.texture?.src;
	if (typeof tokenTextureSource === 'string' && tokenTextureSource.trim().length > 0) {
		return tokenTextureSource.trim();
	}

	const combatantImage = (combatant as unknown as { img?: string }).img;
	if (typeof combatantImage === 'string' && combatantImage.trim().length > 0) {
		return combatantImage.trim();
	}

	if (options.includeActorImage ?? false) {
		const actorImage = (combatant.actor as unknown as { img?: string } | null)?.img;
		if (typeof actorImage === 'string' && actorImage.trim().length > 0) {
			return actorImage.trim();
		}
	}

	return options.fallback ?? null;
}
