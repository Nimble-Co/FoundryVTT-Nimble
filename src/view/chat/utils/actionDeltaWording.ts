/**
 * The localization key for the sentence describing one action adjustment on an
 * activation card, ready to be formatted with `name` and `count` slots.
 *
 * The localization layer only interpolates named slots and has no plural rules,
 * so the singular and plural wordings live in sibling keys and the caller picks
 * between them here. Every key is spelled out rather than assembled from parts
 * so they stay greppable.
 *
 * A delta of zero is not a state any caller displays; it maps to the gain
 * wording rather than throwing, since callers gate on it before formatting.
 */
export function getActionDeltaLocalizationKey(delta: number, appliesNextTurn: boolean): string {
	const isSingular = Math.abs(delta) === 1;

	if (appliesNextTurn) {
		if (delta < 0) {
			return isSingular
				? 'NIMBLE.chat.actionDeltaSummary.loseActionNextTurn'
				: 'NIMBLE.chat.actionDeltaSummary.loseActionsNextTurn';
		}
		return isSingular
			? 'NIMBLE.chat.actionDeltaSummary.gainActionNextTurn'
			: 'NIMBLE.chat.actionDeltaSummary.gainActionsNextTurn';
	}

	if (delta < 0) {
		return isSingular
			? 'NIMBLE.chat.actionDeltaSummary.loseActionNow'
			: 'NIMBLE.chat.actionDeltaSummary.loseActionsNow';
	}
	return isSingular
		? 'NIMBLE.chat.actionDeltaSummary.gainActionNow'
		: 'NIMBLE.chat.actionDeltaSummary.gainActionsNow';
}
