import type {
	DieOutcome,
	IncomingReactionEntry,
	RerollGrant,
	RerollRecord,
	RollUse,
} from '#utils/incomingReactions/incomingReactionEntry.ts';

import localize from '#utils/localize.js';
import { rerollRuleKey } from '#utils/reroll/rerollEntries.ts';
import { signed } from './primaryDieBonusText.ts';
import { statAbbreviation } from './resultChangeLines.ts';

interface RerollHistoryDie {
	faces: number;
	value: number;
	outcome: DieOutcome;
}

/** One thing a use of a reroll changed on the roll or gave a creature. */
interface RerollTag {
	kind:
		| 'automatic'
		| 'rollMode'
		| 'extraDamage'
		| 'action'
		| 'noAction'
		| 'tempHp'
		| 'crit'
		| 'miss'
		| 'stat'
		| 'cannotMiss';
	label: string;
	/** The tag as a sentence: its tooltip, and the note a click on the tag opens. */
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
	/** What to give by hand when Feature Effects is off. */
	offNote: string | null;
	detail: string | null;
	/** The old and the new die; null when either cannot be read */
	dice: { previous: RerollHistoryDie; next: RerollHistoryDie } | null;
	/** A player kept the old roll, so the old die stands and the new one does not. */
	keptOld: boolean;
	/** A change of the die, not a reroll: the label on its arrow ("set", "+1"). */
	change?: { arrow: string };
	/** What the use did: a reroll, a change of the die, or a crit. */
	use: RollUse;
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
	if (entry.kind !== 'reroll' || (entry.use ?? 'reroll') !== 'reroll') return false;
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
	if (record.severalDice && record.severalDice.length > 1) return null;
	const { faces, previous, next } = record;
	if (typeof faces !== 'number' || !previous || !next) return null;
	return { previous: { faces, ...previous }, next: { faces, ...next } };
}

function fromSource(label: string, source: string): string {
	return localize('NIMBLE.chat.incomingReactions.rerollTags.fromSource', { label, source });
}

function buildRollChangeTags(record: RerollRecord): RerollTag[] {
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
		const label = localize(
			`NIMBLE.chat.incomingReactions.rerollTags.${change.value > 0 ? 'advantage' : 'disadvantage'}`,
		);
		return {
			kind: 'rollMode',
			label,
			tooltip:
				typeof dropped === 'number' && typeof kept === 'number'
					? localize('NIMBLE.chat.incomingReactions.rerollTags.rollModeDropped', {
							source: change.label,
							first: String(kept),
							second: String(dropped),
							kept: String(kept),
						})
					: fromSource(label, change.label),
			off: false,
		};
	});
}

function buildGrantTags(grants: readonly RerollGrant[]): {
	tags: RerollTag[];
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
			const label = localize(
				`NIMBLE.chat.incomingReactions.rerollTags.${actions.amount === 1 ? 'action' : 'actions'}`,
				{ name: grant.name, count: String(actions.amount) },
			);
			tags.push({
				kind: 'action',
				label,
				tooltip: fromSource(label, actions.source),
				off: !grant.applied,
			});
		}
	}

	const withTempHp = grants.filter((grant) => grant.tempHp);
	const first = withTempHp[0]?.tempHp;
	if (first) {
		const amount = String(first.amount);
		const gainers = withTempHp.filter((grant) => grant.tempHp?.keeps === null);
		const fresh = gainers.filter((grant) => !grant.tempHp?.had);
		const label =
			gainers.length === 0
				? localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpNobody', { amount })
				: gainers.length === 1
					? localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpOne', {
							amount,
							name: gainers[0].name,
						})
					: localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpMany', {
							amount,
							count: String(gainers.length),
						});
		const parts = [fromSource(label, first.source)];
		// One gainer is named in the label already.
		if (fresh.length > 0 && gainers.length > 1) {
			parts.push(
				localize(
					`NIMBLE.chat.incomingReactions.rerollTags.${fresh.length === 1 ? 'tempHpGainOne' : 'tempHpGain'}`,
					{ names: fresh.map((grant) => grant.name).join(', '), amount },
				),
			);
		}
		const replaced = gainers.filter((grant) => grant.tempHp?.had);
		const kept = withTempHp.filter((grant) => grant.tempHp?.keeps !== null);
		for (const grant of replaced) {
			parts.push(
				localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpReplaced', {
					name: grant.name,
					had: String(grant.tempHp?.had),
					amount,
				}),
			);
		}
		for (const grant of kept) {
			parts.push(
				localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpKeeps', {
					name: grant.name,
					had: String(grant.tempHp?.had),
					amount,
				}),
			);
		}
		if (replaced.length > 0 || kept.length > 0) {
			parts.push(localize('NIMBLE.chat.incomingReactions.rerollTags.tempHpChoice'));
		}
		tags.push({
			kind: 'tempHp',
			label,
			tooltip: parts.join(' '),
			off: withTempHp.some((grant) => !grant.applied),
		});
	}

	const offTempHp = withTempHp.some((grant) => !grant.applied);
	const offAction = tags.some((tag) => tag.kind === 'action' && tag.off);
	const offKey =
		offTempHp && offAction ? 'offTempHpAndAction' : offTempHp ? 'offTempHp' : 'offAction';
	const offNote =
		offTempHp || offAction ? localize(`NIMBLE.chat.incomingReactions.rerollTags.${offKey}`) : null;

	return { tags: [...tags, ...notGiven], offNote };
}

/** What a reroll did to the new roll besides its dice: the stat it used, a hit it made sure of. */
function buildNewRollTags(record: RerollRecord, feature: string): RerollTag[] {
	const tags: RerollTag[] = [];
	if (record.stat) {
		const stat = statAbbreviation(record.stat);
		tags.push({
			kind: 'stat',
			label: localize('NIMBLE.chat.incomingReactions.rerollTags.stat', { stat }),
			tooltip: localize('NIMBLE.chat.incomingReactions.rerollTags.statTooltip', { feature, stat }),
			off: false,
		});
	}
	if (record.cannotMissBy) {
		tags.push({
			kind: 'cannotMiss',
			label: localize('NIMBLE.chat.incomingReactions.rerollTags.cannotMiss'),
			tooltip: localize('NIMBLE.chat.incomingReactions.rerollTags.cannotMissTooltip', {
				feature: record.cannotMissBy,
			}),
			off: false,
		});
	}
	return tags;
}

/** The tags of a change: the outcome it made. */
function buildChangeTags(record: RerollRecord, feature: string): RerollTag[] {
	const tags: RerollTag[] = [];
	const outcome = record.next?.outcome;
	if (outcome) {
		tags.push({
			kind: outcome,
			label: localize(`NIMBLE.chat.incomingReactions.rerollTags.${outcome}`),
			tooltip: localize(`NIMBLE.chat.incomingReactions.rerollTags.${outcome}Tooltip`, { feature }),
			off: false,
		});
	}
	return tags;
}

function changeText(record: RerollRecord, feature: string): string {
	const outcome = record.next?.outcome;
	const key =
		outcome === 'crit'
			? 'changeHistoryCrit'
			: outcome === 'miss'
				? 'changeHistoryMiss'
				: 'changeHistory';
	return localize(`NIMBLE.chat.incomingReactions.${key}`, {
		feature,
		previous: String(record.previous?.value ?? ''),
		next: String(record.next?.value ?? ''),
	});
}

/**
 * The card's reroll history, one line per reroll or change: the feature, then who used
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
		if (record.severalDice && record.severalDice.length > 1) {
			details.push(
				record.severalDice.map((die) => `${die.previous} \u2192 ${die.next}`).join(', '),
			);
		}
		if (record.noActionLeft) {
			details.push(localize('NIMBLE.chat.incomingReactions.noActionLeft'));
		}
		if (record.woundsGained > 0) {
			details.push(
				localize('NIMBLE.chat.incomingReactions.rerollWoundsGained', {
					count: String(record.woundsGained),
				}),
			);
		}

		if (record.use === 'effect') {
			return {
				title: feature,
				tags: [],
				offNote: null,
				text: localize(
					`NIMBLE.chat.incomingReactions.effectHistory.${record.effect ?? 'critD20'}`,
					{
						feature,
					},
				),
				detail: details.length > 0 ? details.join(' - ') : null,
				dice: dice(record),
				keptOld: false,
				use: 'effect',
			};
		}

		if (record.use === 'crit') {
			return {
				title: feature,
				tags: [
					{
						kind: 'crit',
						label: localize('NIMBLE.chat.incomingReactions.rerollTags.crit'),
						tooltip: localize('NIMBLE.chat.incomingReactions.rerollTags.critMadeTooltip', {
							feature,
						}),
						off: false,
					},
				],
				offNote: null,
				text: localize('NIMBLE.chat.incomingReactions.critHistory', { feature }),
				detail: details.length > 0 ? details.join(' - ') : null,
				dice: dice(record),
				keptOld: false,
				use: 'crit',
			};
		}

		if (record.use === 'change') {
			const mode = record.change?.mode ?? 'set';
			return {
				title: feature,
				tags: buildChangeTags(record, feature),
				offNote: null,
				text: changeText(record, feature),
				detail: details.length > 0 ? details.join(' - ') : null,
				dice: dice(record),
				keptOld: false,
				change: {
					arrow:
						mode === 'add'
							? signed(record.change?.value ?? 0)
							: localize('NIMBLE.chat.incomingReactions.changeArrowSet'),
				},
				use: 'change',
			};
		}

		const kept = record.kept && typeof record.keptTotal === 'number';
		const given = buildGrantTags(record.grants ?? []);
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
			tags: [
				...automatic,
				...buildNewRollTags(record, feature),
				...buildRollChangeTags(record),
				...given.tags,
			],
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
			use: 'reroll',
		};
	});
}
