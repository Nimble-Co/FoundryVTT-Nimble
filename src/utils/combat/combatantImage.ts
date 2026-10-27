/**
 * Paths produced by Tokenizer / VTTA Tokenizer live under these prefixes. When those modules are
 * not active, Foundry cannot serve the files (404 / Invalid Asset); prefer the next image candidate.
 */
function isTokenizerManagedPath(src: string): boolean {
	const lower = src.trim().toLowerCase();
	return (
		lower.includes('/tokenizer/') ||
		lower.startsWith('tokenizer/') ||
		lower.includes('/vtta-tokenizer/') ||
		lower.startsWith('vtta-tokenizer/')
	);
}

function isTokenizerModuleActive(): boolean {
	const modules = game.modules;
	if (!modules) return false;
	return (
		modules.get('tokenizer')?.active === true || modules.get('vtta-tokenizer')?.active === true
	);
}

function resolvePortraitCandidate(src: string | null | undefined): string | null {
	if (typeof src !== 'string') return null;
	const trimmed = src.trim();
	if (trimmed.length === 0) return null;
	if (isTokenizerManagedPath(trimmed) && !isTokenizerModuleActive()) return null;
	return trimmed;
}

export function getCombatantImage(
	combatant: Combatant.Implementation,
	options: { includeActorImage?: boolean; fallback?: string | null } = {},
): string | null {
	const tokenTextureSource = (combatant.token as unknown as { texture?: { src?: string } } | null)
		?.texture?.src;
	const fromToken = resolvePortraitCandidate(tokenTextureSource);
	if (fromToken) return fromToken;

	const combatantImage = (combatant as unknown as { img?: string }).img;
	const fromCombatant = resolvePortraitCandidate(combatantImage);
	if (fromCombatant) return fromCombatant;

	if (options.includeActorImage ?? false) {
		const actorImage = (combatant.actor as unknown as { img?: string } | null)?.img;
		const fromActor = resolvePortraitCandidate(actorImage);
		if (fromActor) return fromActor;
	}

	return options.fallback ?? null;
}
