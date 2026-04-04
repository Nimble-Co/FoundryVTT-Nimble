import type { SpellGrantResult, SpellGrantSource } from '../types.js';

/**
 * Checks if there are any spell grants from the given source (or any source if not specified).
 */
export function hasSpellGrants(
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

/**
 * Gets the rule IDs for grant spell selection rules of a specific mode.
 */
export function getGrantSpellSelectionRuleIds(
	rules: Array<{ type: string; [key: string]: unknown }>,
	mode: 'selectSchool' | 'selectSpell',
): string[] {
	return rules.flatMap((rule) => {
		if (rule.type !== 'grantSpells') return [];
		if ((rule.mode ?? 'auto') !== mode) return [];
		return typeof rule.id === 'string' ? [rule.id] : [];
	});
}

/**
 * Removes selections for the given rule IDs from a selections map.
 */
export function removeSelectionsForRuleIds<T>(
	selections: Map<string, T>,
	ruleIds: string[],
): Map<string, T> {
	if (ruleIds.length === 0) return selections;

	const nextSelections = new Map(selections);
	for (const ruleId of ruleIds) {
		nextSelections.delete(ruleId);
	}

	return nextSelections;
}

/**
 * Removes confirmed schools for the given rule IDs from a confirmed schools set.
 */
export function removeConfirmedSchoolsForRuleIds(
	confirmedSchools: Set<string>,
	ruleIds: string[],
): Set<string> {
	if (ruleIds.length === 0) return confirmedSchools;

	const nextConfirmedSchools = new Set(confirmedSchools);
	for (const ruleId of ruleIds) {
		nextConfirmedSchools.delete(ruleId);
	}

	return nextConfirmedSchools;
}

/**
 * Checks if all spell selections are complete for the given source filter.
 */
export function spellSelectionsComplete(
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
