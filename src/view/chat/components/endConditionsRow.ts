import type { EndConditionsNode } from '#types/effectTree.js';
import type { EndedConditionsRecord } from '#utils/chat/endConditionsFromCard.js';
import type { Format, Localize } from '#utils/lastsUntil/describeLastsUntil.js';

const WORDS = 'NIMBLE.chat.endConditions';
const EFFECT_WORDS = 'NIMBLE.chat.applyEffect';

export interface EndConditionsRowInput {
	node: Pick<EndConditionsNode, 'recipient' | 'which' | 'conditions'>;
	ended: Readonly<Record<string, EndedConditionsRecord>> | undefined;
	/** The name of each condition, by id. */
	conditionNames: Readonly<Record<string, string>>;
	/** the user rolled the card, or is a GM */
	canApply: boolean;
	/** the card has targets; a card for "you" has its user */
	hasRecipient: boolean;
	localize: Localize;
	format: Format;
}

export interface EndConditionsRowView {
	name: string;
	/** after the click: "Ended on Tessa, Bram" */
	appliedLines: string[];
	/** after the click: "Nothing to end on Kobold" */
	notes: string[];
	button: { label: string; disabled: boolean; tooltip: string | null } | null;
}

function nameOf(input: EndConditionsRowInput): string {
	const { node, conditionNames, localize, format } = input;
	if (node.which === 'negative') return localize(`${WORDS}.negative`);
	const names = node.conditions.map((id) => conditionNames[id] ?? id).join(', ');
	return format(`${WORDS}.listed`, { names });
}

export function endConditionsRow(input: EndConditionsRowInput): EndConditionsRowView {
	const { localize, format, node } = input;
	const name = nameOf(input);
	const records = Object.values(input.ended ?? {});
	if (records.length > 0) {
		const ended = records
			.filter((record) => record.ended.length > 0)
			.map((record) => record.actorName)
			.join(', ');
		return {
			name,
			appliedLines: ended ? [format(`${WORDS}.endedOn`, { names: ended })] : [],
			notes: records
				.filter((record) => record.ended.length < 1)
				.map((record) => format(`${WORDS}.nothingOn`, { name: record.actorName })),
			button: null,
		};
	}
	const self = node.recipient === 'self';
	return {
		name,
		appliedLines: [],
		notes: [],
		button: input.canApply
			? {
					label: localize(self ? `${EFFECT_WORDS}.applyToYou` : `${EFFECT_WORDS}.applyToTargets`),
					disabled: !input.hasRecipient,
					tooltip: input.hasRecipient ? null : localize(`${EFFECT_WORDS}.noTargets`),
				}
			: null,
	};
}
