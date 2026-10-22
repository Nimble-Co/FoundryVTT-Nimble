import type {
	DieOutcome,
	IncomingReactionEntry,
	RerollRecord,
} from '#utils/incomingReactionEntry.ts';

import localize from '#utils/localize.js';
import { rerollRuleKey } from '#utils/rerollEntries.ts';

interface RerollHistoryDie {
	faces: number;
	value: number;
	outcome: DieOutcome;
}

interface RerollHistoryLine {
	text: string;
	detail: string | null;
	/** The old and the new Primary Die; null when either cannot be read */
	dice: { previous: RerollHistoryDie; next: RerollHistoryDie } | null;
}

interface RerollHistoryInput {
	/** The card's rerolls, in roll order */
	records: RerollRecord[];
	speakerUuid: string;
	/** Records whose feature shows a "Reroll again" button */
	rerollAgain: ReadonlySet<RerollRecord>;
	/** The name of the item or actor with this uuid */
	documentName: (uuid: string) => string | null | undefined;
}

/** A waiting reroll entry is a "Reroll again" when its rule already rerolled in this list. */
export function isRerollAgain(entry: IncomingReactionEntry, records: RerollRecord[]): boolean {
	if (entry.kind !== 'reroll') return false;
	const key = rerollRuleKey(entry);
	return records.some((record) => rerollRuleKey(record) === key);
}

/** The records whose rule has one of `entries` as its "Reroll again" button. */
export function rerollAgainRecords(
	records: RerollRecord[],
	entries: IncomingReactionEntry[],
): Set<RerollRecord> {
	return new Set(
		records.filter((record) => entries.some((entry) => isRerollAgain(entry, [record]))),
	);
}

function dice(record: RerollRecord): RerollHistoryLine['dice'] {
	const { faces, previous, next } = record;
	if (typeof faces !== 'number' || !previous || !next) return null;
	return { previous: { faces, ...previous }, next: { faces, ...next } };
}

/**
 * The card's reroll history, one line per reroll: the feature, then who used
 * it and what it cost. The name and the uses left are left out when the card
 * header or a "Reroll again" button already show them.
 */
export function rerollHistoryLines(input: RerollHistoryInput): RerollHistoryLine[] {
	return input.records.map((record) => {
		const feature = (input.documentName(record.itemUuid) ?? '').trim() || record.label;
		const rerollAgain = input.rerollAgain.has(record);

		const details: string[] = [];
		if (record.actorUuid !== input.speakerUuid && !rerollAgain) {
			const name = (input.documentName(record.actorUuid) ?? '').trim();
			details.push(localize('NIMBLE.chat.incomingReactions.rerollUsedBy', { name }));
		}
		if (typeof record.usesLeft === 'number' && !rerollAgain) {
			details.push(
				localize('NIMBLE.chat.incomingReactions.rerollUsesLeft', {
					count: String(record.usesLeft),
				}),
			);
		}
		if (record.woundsGained > 0) {
			details.push(
				localize('NIMBLE.chat.incomingReactions.rerollWoundsGained', {
					count: String(record.woundsGained),
				}),
			);
		}

		return {
			text: localize('NIMBLE.chat.incomingReactions.rerollHistoryPlain', { feature }),
			detail: details.length > 0 ? details.join(' - ') : null,
			dice: dice(record),
		};
	});
}
