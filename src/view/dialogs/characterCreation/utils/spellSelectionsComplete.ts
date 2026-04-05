import type { SpellGrantResult, SpellGrantSource } from '../types.js';

/**
 * Checks if all spell selections are complete for the given source filter.
 */
export default function spellSelectionsComplete(
	grants: SpellGrantResult | null,
	selectedSchools: Map<string, string[]>,
	selectedSpells: Map<string, string[]>,
	confirmedSchools: Set<string>,
	sourceFilter?: SpellGrantSource,
): boolean {
	if (!grants) return true;

	// Check that all school selection groups have enough schools selected AND are confirmed
	for (const group of grants.schoolSelections) {
		// Skip if filtering by source and this group doesn't match
		if (sourceFilter && group.source !== sourceFilter) continue;

		const selected = selectedSchools.get(group.ruleId) ?? [];
		// Cap required count at available options to prevent stuck state
		const requiredCount = Math.min(group.count, group.availableSchools.length);
		if (selected.length < requiredCount) {
			return false;
		}
		// Also require confirmation
		if (!confirmedSchools.has(group.ruleId)) {
			return false;
		}
	}

	// Check that all spell selection groups have enough spells selected
	for (const group of grants.spellSelections) {
		// Skip if filtering by source and this group doesn't match
		if (sourceFilter && group.source !== sourceFilter) continue;

		const selected = selectedSpells.get(group.ruleId) ?? [];
		// Cap required count at available options to prevent stuck state
		const requiredCount = Math.min(group.count, group.availableSpells.length);
		if (selected.length < requiredCount) {
			return false;
		}
	}

	return true;
}
