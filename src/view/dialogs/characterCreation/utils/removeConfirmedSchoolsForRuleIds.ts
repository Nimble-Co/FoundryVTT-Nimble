/**
 * Removes confirmed schools for the given rule IDs from a confirmed schools set.
 */
export default function removeConfirmedSchoolsForRuleIds(
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
