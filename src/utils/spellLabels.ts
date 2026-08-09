import localize from './localize.js';

/**
 * Localized display name for a spell school, falling back to the raw id when the
 * school is not in `CONFIG.NIMBLE.spellSchools` — a GM-defined school that has
 * since been deleted, for instance.
 *
 * Note two older variants exist with different fallbacks:
 * `compendiumSpellsFilter.ts` title-cases the raw id, and
 * `characterCreator/SpellCard.svelte.ts` localizes it. They are left alone rather
 * than folded in here, because converging them would change what those screens
 * render.
 */
export function getSpellSchoolLabel(school: string): string {
	const label = (CONFIG.NIMBLE?.spellSchools as Record<string, string> | undefined)?.[school];
	return label ? localize(label) : school;
}

/**
 * Localized display name for a spell tier — "Cantrip" for tier 0, "Tier 3" and so
 * on — falling back to the bare number for a tier with no configured label.
 *
 * Used wherever a tier is shown to a player, so a cantrip never surfaces as the
 * literal "tier 0".
 */
export function getSpellTierLabel(tier: number): string {
	const label = (CONFIG.NIMBLE?.spellTiers as Record<number, string> | undefined)?.[tier];
	return label ? localize(label) : String(tier);
}
