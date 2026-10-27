import type {
	DieOutcome,
	IncomingReactionEntry,
	RerollGrant,
	RerollRecord,
} from '#utils/incomingReactionEntry.ts';

import localize from '#utils/localize.js';
import { rerollRuleKey } from '#utils/rerollEntries.ts';

interface RerollHistoryDie {
	faces: number;
	value: number;
	outcome: DieOutcome;
}

/** One thing a use of a reroll changed on the roll or gave a creature. */
interface RerollTag {
	kind: 'automatic' | 'rollMode' | 'extraDamage' | 'action' | 'noAction' | 'tempHp';
	label: string;
	tooltip: string;
	/** Not applied, because Feature Effects is off: the GM gives it by hand. */
	off: boolean;
}

interface RerollHistoryLine {
	/** The feature that rerolled. */
	title: string;
	/** The whole line as a sentence, for its tooltip. */
	text: string;
	tags: RerollTag[];
	/** Who gained temp HP and who kept their own, shown from the temp HP tag. */
	tempHpNote: string | null;
	/** What to give by hand when Feature Effects is off. */
	offNote: string | null;
	detail: string | null;
	/** The old and the new Primary Die; null when either cannot be read */
	dice: { previous: RerollHistoryDie; next: RerollHistoryDie } | null;
	/** A player kept the old roll, so the old die stands and the new one does not. */
	keptOld: boolean;
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

function rollChangeTags(record: RerollRecord): RerollTag[] {
	return (record.changes ?? []).map((change) => {
		if (change.kind === 'extraDamage') {
			const values = { amount: String(change.value), source: change.label };
			return {
				kind: 'extraDamage',
				label: localize('NIMBLE.chat.incomingReactions.rerollTags.extraDamage', values),
				tooltip: localize('NIMBLE.chat.incomingReactions.rerollTags.extraDamageTooltip', values),
				off: false,
			};
		}
		const kept = record.next?.value;
		const dropped = record.dropped;
		return {
			kind: 'rollMode',
			label: localize(
				`NIMBLE.chat.incomingReactions.rerollTags.${change.value > 0 ? 'advantage' : 'disadvantage'}`,
			),
			tooltip:
				typeof dropped === 'number' && typeof kept === 'number'
					? localize('NIMBLE.chat.incomingReactions.rerollTags.rollModeDropped', {
							source: change.label,
							first: String(kept),
							second: String(dropped),
							kept: String(kept),
						})
					: change.label,
			off: false,
		};
	});
}

function grantTags(grants: readonly RerollGrant[]): {
	tags: RerollTag[];
	tempHpNote: string | null;
	offNote: string | null;
} {
	const tags: RerollTag[] = [];
	const notGiven: RerollTag[] = [];
	for (const grant of grants) {
		const actions = grant.actions;
		if (actions?.reason) {
			const reason = actions.reason === 'notInCombat' ? 'NotInCombat' : 'NotACharacter';
			notGiven.push({
				kind: 'noAction',
				label: localize(`NIMBLE.chat.incomingReactions.rerollTags.noAction${reason}`),
				tooltip: localize(`NIMBLE.chat.incomingReactions.rerollTags.noActionTooltip${reason}`, {
					source: actions.source,
				}),
				off: false,
			});
		} else if (actions && actions.amount > 0) {
			tags.push({
				kind: 'action',
				label: localize(
					`NIMBLE.chat.incomingReactions.rerollTags.${actions.amount === 1 ? 'action' : 'actions'}`,
					{ name: grant.name, count: String(actions.amount) },
				),
				tooltip: actions.source,
				off: !grant.applied,
			});
		}
	}

	const withTempHp = grants.filter((grant) => grant.tempHp);
	let tempHpNote: string | null = null;
	const first = withTempHp[0]?.tempHp;
	if (first) {
		const gainers = withTempHp.filter((grant) => grant.tempHp?.keeps === null);
		tags.push({
			kind: 'tempHp',
			label: localize('NIMBLE.chat.incomingReactions.rerollTags.tempHp', {
				amount: String(first.amount),
				count: String(gainers.length),
			}),
			tooltip: first.source,
			off: withTempHp.some((grant) => !grant.applied),
		});
		const parts: string[] = [];
		if (gainers.length > 0) {
			parts.push(
				localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpGain', {
					names: gainers.map((grant) => grant.name).join(', '),
					amount: String(first.amount),
				}),
			);
		}
		for (const grant of withTempHp) {
			if (grant.tempHp?.keeps === null || !grant.tempHp) continue;
			parts.push(
				localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpKeeps', {
					name: grant.name,
					temp: String(grant.tempHp.keeps),
				}),
			);
		}
		tempHpNote = parts.join(' ');
	}

	const offTempHp = withTempHp.some((grant) => !grant.applied);
	const offAction = tags.some((tag) => tag.kind === 'action' && tag.off);
	const offKey =
		offTempHp && offAction ? 'offTempHpAndAction' : offTempHp ? 'offTempHp' : 'offAction';
	const offNote =
		offTempHp || offAction ? localize(`NIMBLE.chat.incomingReactions.rerollTags.${offKey}`) : null;

	return { tags: [...tags, ...notGiven], tempHpNote, offNote };
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

		const kept = record.kept && typeof record.keptTotal === 'number';
		const given = grantTags(record.grants ?? []);
		const automatic: RerollTag[] = record.automatic
			? [
					{
						kind: 'automatic',
						label: localize('NIMBLE.chat.incomingReactions.rerollTags.automatic'),
						tooltip: localize('NIMBLE.chat.incomingReactions.rerollTags.automaticTooltip', {
							feature,
						}),
						off: false,
					},
				]
			: [];
		return {
			title: feature,
			tags: [...automatic, ...rollChangeTags(record), ...given.tags],
			tempHpNote: given.tempHpNote,
			offNote: given.offNote,
			text: kept
				? localize('NIMBLE.chat.incomingReactions.rerollHistoryKept', {
						feature,
						total: String(record.keptTotal),
					})
				: localize(
						record.automatic
							? 'NIMBLE.chat.incomingReactions.rerollHistoryAutomatic'
							: 'NIMBLE.chat.incomingReactions.rerollHistoryPlain',
						{ feature },
					),
			detail: details.length > 0 ? details.join(' - ') : null,
			dice: dice(record),
			keptOld: record.kept === 'old',
		};
	});
}
