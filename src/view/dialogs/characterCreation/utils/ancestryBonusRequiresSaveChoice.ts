// `NimbleAncestryBonusItem` is a global ambient type (src/documents/item/item.d.ts).

/**
 * Whether an ancestry bonus carries a save rule the player still has to choose a save for.
 * The rule lives on the swappable bonus trait, not the ancestry, so swapping the bonus can
 * add or remove this step.
 *
 * The `target` is deliberately not narrowed to `neutral`: `resolveSavingThrowRollModes`
 * drops *any* `requiresChoice` rule when no save has been picked, so gating only on neutral
 * would let a homebrew rule with another target be silently discarded at submit time.
 */
export function ancestryBonusRequiresSaveChoice(
	ancestryBonus: NimbleAncestryBonusItem | null,
): boolean {
	const rules = [...(ancestryBonus?.rules?.values() ?? [])];
	if (!rules.length) return false;

	for (const rule of rules) {
		// `disabled` and `situation` are checked here to match `resolveSavingThrowRollModes`,
		// which skips both at submit time. Without them a disabled rule — or a situational one,
		// which is only ever a reminder and never moves a save — would force the player through
		// a save choice that is then thrown away.
		if (
			!rule.disabled &&
			!rule.situation &&
			rule.type === 'savingThrowRollMode' &&
			rule.requiresChoice
		) {
			return true;
		}
	}

	return false;
}
