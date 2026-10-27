/**
 * The localization key describing a pending action adjustment, ready to be
 * formatted with a `count` slot holding the adjustment's absolute size.
 *
 * The localization layer only interpolates named slots and has no plural rules,
 * so the singular and plural wordings live in sibling keys and the caller picks
 * between them here. Shared by the character sheet's action tracker and the
 * combat tracker so both describe the same adjustment identically.
 *
 * A delta of zero is not a state any caller displays; it maps to the gain
 * wording rather than throwing, since callers gate on it before formatting.
 */
export function getPendingActionsLocalizationKey(pendingDelta: number): string {
	const isSingular = Math.abs(pendingDelta) === 1;

	if (pendingDelta < 0) {
		return isSingular
			? 'NIMBLE.ui.heroicActions.pendingActionLoss'
			: 'NIMBLE.ui.heroicActions.pendingActionsLoss';
	}

	return isSingular
		? 'NIMBLE.ui.heroicActions.pendingActionGain'
		: 'NIMBLE.ui.heroicActions.pendingActionsGain';
}
