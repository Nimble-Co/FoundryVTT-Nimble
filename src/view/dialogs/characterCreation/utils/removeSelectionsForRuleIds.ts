/**
 * Removes selections for the given rule IDs from a selections map.
 */
export default function removeSelectionsForRuleIds<T>(
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
