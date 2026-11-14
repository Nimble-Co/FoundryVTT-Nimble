import type { Localize } from '#utils/lastsUntil/describeLastsUntil.js';

const WORDS = 'NIMBLE.chat.applyEffect';

export interface StepButton {
	label: string;
	disabled: boolean;
	tooltip: string | null;
}

export interface StepButtonInput {
	recipient: string;
	/** the user rolled the card, or is a GM */
	canApply: boolean;
	/** the card has targets; a card for "you" has its user */
	hasRecipient: boolean;
	localize: Localize;
}

/** The button of a card step that waits for a click: to you, or to the targets. */
export function stepButton(input: StepButtonInput): StepButton | null {
	if (!input.canApply) return null;
	const { localize, hasRecipient } = input;
	return {
		label: localize(input.recipient === 'self' ? `${WORDS}.applyToYou` : `${WORDS}.applyToTargets`),
		disabled: !hasRecipient,
		tooltip: hasRecipient ? null : localize(`${WORDS}.noTargets`),
	};
}
