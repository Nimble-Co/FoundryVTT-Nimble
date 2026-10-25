import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';
import localize from '#utils/localize.js';

interface LeftOutTokens {
	allyName: string;
	allyDisposition: number | null | undefined;
	rollerDisposition: number | null | undefined;
}

function dispositionLabel(disposition: number | null | undefined): string | null {
	if (typeof disposition !== 'number') return null;
	const key = Object.entries(CONST.TOKEN_DISPOSITIONS).find(
		([, value]) => value === disposition,
	)?.[0];
	return key ? localize(`TOKEN.DISPOSITION.${key}`) : null;
}

/** Why the ally scan left this reroll out, for the GM. */
export function leftOutRerollReason(entry: IncomingReactionEntry, tokens: LeftOutTokens): string {
	const leftOut = entry.leftOut;
	if (leftOut?.reason === 'range') {
		return localize('NIMBLE.chat.incomingReactions.leftOut.range', {
			spaces: String(leftOut.spaces),
			range: String(leftOut.range),
		});
	}
	const disposition = dispositionLabel(tokens.allyDisposition);
	const rollerDisposition = dispositionLabel(tokens.rollerDisposition);
	if (disposition && rollerDisposition) {
		return localize('NIMBLE.chat.incomingReactions.leftOut.disposition', {
			name: tokens.allyName,
			disposition,
			rollerDisposition,
		});
	}
	return localize('NIMBLE.chat.incomingReactions.leftOut.notAlly', { name: tokens.allyName });
}
