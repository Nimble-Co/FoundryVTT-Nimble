import localize from './localize.js';

/**
 * Localized display name for a spell school, falling back to the raw id for a
 * school missing from `CONFIG.NIMBLE.spellSchools`, such as a GM-defined one that
 * has since been deleted.
 */
export function getSpellSchoolLabel(school: string): string {
	const label = (CONFIG.NIMBLE?.spellSchools as Record<string, string> | undefined)?.[school];
	return label ? localize(label) : school;
}

/**
 * Localized display name for a spell tier ("Cantrip" for tier 0, "Tier 3" and so
 * on), falling back to the bare number for a tier with no configured label. Use
 * it wherever a tier is shown, so a cantrip never surfaces as "tier 0".
 */
export function getSpellTierLabel(tier: number): string {
	const label = (CONFIG.NIMBLE?.spellTiers as Record<number, string> | undefined)?.[tier];
	return label ? localize(label) : String(tier);
}
