/**
 * Gets the rule IDs for grant spell selection rules of a specific mode.
 */
export default function getGrantSpellSelectionRuleIds(
	rules: Array<{ type: string; [key: string]: unknown }>,
	mode: 'selectSchool' | 'selectSpell',
): string[] {
	return rules.flatMap((rule) => {
		if (rule.type !== 'grantSpells') return [];
		if ((rule.mode ?? 'auto') !== mode) return [];
		return typeof rule.id === 'string' ? [rule.id] : [];
	});
}
