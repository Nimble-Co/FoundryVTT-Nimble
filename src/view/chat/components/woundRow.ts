import type { WoundNode } from '#types/effectTree.js';
import type { WoundRecord } from '#utils/actor/giveWounds.js';
import type { Format, Localize } from '#utils/lastsUntil/describeLastsUntil.js';

const WORDS = 'NIMBLE.chat.wound';
const EFFECT_WORDS = 'NIMBLE.chat.applyEffect';

export interface WoundRowInput {
	node: Pick<WoundNode, 'recipient' | 'amount'>;
	applied: Readonly<Record<string, WoundRecord>> | undefined;
	/** the user rolled the card, or is a GM */
	canApply: boolean;
	/** the card has targets; a card for "you" has its user */
	hasRecipient: boolean;
	localize: Localize;
	format: Format;
}

export interface WoundRowView {
	name: string;
	/** after the click: "On Tessa, Bram" */
	appliedLines: string[];
	/** after the click: "Kobold has no Wounds", one for each creature with no track */
	noTrackLines: string[];
	button: { label: string; disabled: boolean; tooltip: string | null } | null;
}

export function woundRow(input: WoundRowInput): WoundRowView {
	const { localize, format, node } = input;
	const name =
		node.amount === 1
			? localize(`${WORDS}.one`)
			: format(`${WORDS}.many`, { count: String(node.amount) });
	const records = Object.values(input.applied ?? {});
	if (records.length > 0) {
		const on = records
			.filter((record) => !('noTrack' in record))
			.map((record) => record.actorName)
			.filter(Boolean)
			.join(', ');
		return {
			name,
			appliedLines: on ? [format(`${EFFECT_WORDS}.on`, { names: on })] : [],
			noTrackLines: records
				.filter((record) => 'noTrack' in record)
				.map((record) => format(`${WORDS}.noTrack`, { name: record.actorName })),
			button: null,
		};
	}
	const self = node.recipient === 'self';
	return {
		name,
		appliedLines: [],
		noTrackLines: [],
		button: input.canApply
			? {
					label: localize(self ? `${EFFECT_WORDS}.applyToYou` : `${EFFECT_WORDS}.applyToTargets`),
					disabled: !input.hasRecipient,
					tooltip: input.hasRecipient ? null : localize(`${EFFECT_WORDS}.noTargets`),
				}
			: null,
	};
}
