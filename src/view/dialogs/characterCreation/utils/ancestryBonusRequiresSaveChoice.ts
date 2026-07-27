// `NimbleAncestryBonusItem` is a global ambient type (src/documents/item/item.d.ts).

/**
 * Whether an ancestry bonus carries a neutral-save rule the player still has to
 * choose a save for. The rule lives on the swappable bonus trait, not the ancestry,
 * so swapping the bonus can add or remove this step.
 */
export function ancestryBonusRequiresSaveChoice(
	ancestryBonus: NimbleAncestryBonusItem | null,
): boolean {
	const rules = [...(ancestryBonus?.rules?.values() ?? [])];
	if (!rules.length) return false;

	for (const rule of rules) {
		// `disabled` is checked here to match `resolveSavingThrowRollModes`, which skips
		// disabled rules at submit time. Without it a disabled rule would force the player
		// through a save choice that is then thrown away.
		if (
			!rule.disabled &&
			rule.type === 'savingThrowRollMode' &&
			rule.requiresChoice &&
			rule.target === 'neutral'
		) {
			return true;
		}
	}

	return false;
}
