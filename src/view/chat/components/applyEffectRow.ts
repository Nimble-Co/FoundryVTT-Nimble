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
	/** after the click: "On Goblin, Kobold" */
	appliedLine: string | null;
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
			appliedLine: null,
			button: null,
			note: localize(`${WORDS}.missing`),
		};
	}
	const self = input.node.recipient === 'self';
	const lasts = describeLastsUntil({
		moments: source.lastsUntil,
		usedUp: source.usedUp ?? null,
		coreDuration: source.coreDuration ?? null,
		escape: source.escape,
		reader: self ? CARD_SELF_READER : CARD_TARGETS_READER,
		localize,
		format,
	});
	const names = (input.applied ?? []).map((entry) => entry.actorName).filter(Boolean);
	if (names.length) {
		return {
			name: source.name,
			img: source.img,
			lasts,
			appliedLine: format(`${WORDS}.on`, { names: names.join(', ') }),
			button: null,
			note: null,
		};
	}
	return {
		name: source.name,
		img: source.img,
		lasts,
		appliedLine: null,
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
