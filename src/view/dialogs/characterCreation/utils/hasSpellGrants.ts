import type { SpellGrantResult, SpellGrantSource } from '../types.js';

/**
 * Checks if there are any spell grants from the given source (or any source if not specified).
 */
export default function hasSpellGrants(
	grants: SpellGrantResult | null,
	sourceFilter?: SpellGrantSource,
): boolean {
	if (!grants) return false;

	// If no filter, check if there are any grants
	if (!sourceFilter) {
		return grants.hasGrants;
	}

	// Check if there are grants from the specified source
	// Auto-grants are always from class features
	const hasAutoGrant = sourceFilter === 'class' && grants.autoGrant.length > 0;
	const hasSchoolSelections = grants.schoolSelections.some((g) => g.source === sourceFilter);
	const hasSpellSelections = grants.spellSelections.some((g) => g.source === sourceFilter);

	return hasAutoGrant || hasSchoolSelections || hasSpellSelections;
}
