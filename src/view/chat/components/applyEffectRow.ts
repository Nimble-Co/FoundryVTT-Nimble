import type { ApplyEffectNode, ApplyEffectSource } from '#types/effectTree.js';
import type { AppliedEffect } from '#utils/actor/applyEffectToActor.js';
import {
	CARD_SELF_READER,
	CARD_TARGETS_READER,
	describeLastsUntil,
	type Format,
	type Localize,
} from '#utils/lastsUntil/describeLastsUntil.js';

const WORDS = 'NIMBLE.chat.applyEffect';

export interface ApplyEffectRowInput {
	node: Pick<ApplyEffectNode, 'recipient'>;
	/** null: the item no longer has the effect */
	source: ApplyEffectSource | null;
	applied: readonly AppliedEffect[] | undefined;
	/** the user rolled the card, or is a GM */
	canApply: boolean;
	/** the card has targets; a card for "you" has its user */
	hasRecipient: boolean;
	localize: Localize;
	format: Format;
}

export interface ApplyEffectRowView {
	name: string;
	img: string;
	lasts: string;
	/** after the click: "On Goblin, Kobold", and "Raging stays on Hero" for a holder that kept it */
	appliedLines: string[];
	button: { label: string; disabled: boolean; tooltip: string | null } | null;
	/** a line in place of the button */
	note: string | null;
}

export function applyEffectRow(input: ApplyEffectRowInput): ApplyEffectRowView {
	const { localize, format, source } = input;
	if (!source) {
		return {
			name: localize(`${WORDS}.missingName`),
			img: 'icons/svg/hazard.svg',
			lasts: '',
			appliedLines: [],
			button: null,
			note: localize(`${WORDS}.missing`),
		};
	}
	const self = input.node.recipient === 'self';
	const lasts = describeLastsUntil({
		moments: source.lastsUntil,
		usedUp: source.usedUp ?? null,
		escape: source.escape,
		reader: self ? CARD_SELF_READER : CARD_TARGETS_READER,
		localize,
		format,
	});
	const applied = input.applied ?? [];
	const namesOf = (stays: boolean) =>
		applied
			.filter((entry) => !!entry.stays === stays)
			.map((entry) => entry.actorName)
			.filter(Boolean)
			.join(', ');
	const on = namesOf(false);
	const stays = namesOf(true);
	if (on || stays) {
		return {
			name: source.name,
			img: source.img,
			lasts,
			appliedLines: [
				...(on ? [format(`${WORDS}.on`, { names: on })] : []),
				...(stays ? [format(`${WORDS}.stays`, { name: source.name, holder: stays })] : []),
			],
			button: null,
			note: null,
		};
	}
	return {
		name: source.name,
		img: source.img,
		lasts,
		appliedLines: [],
		button: input.canApply
			? {
					label: localize(self ? `${WORDS}.applyToYou` : `${WORDS}.applyToTargets`),
					disabled: !input.hasRecipient,
					tooltip: input.hasRecipient ? null : localize(`${WORDS}.noTargets`),
				}
			: null,
		note: null,
	};
}
