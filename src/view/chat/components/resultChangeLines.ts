import type { ResultChangeLine } from '#types/components/ResultChangeLines.d.ts';
import type { ResultChange, ResultUse } from '#types/resultChange.d.ts';

import localize from '#utils/localize.js';
import { NATURAL_20, resultTotal, standingResultChanges } from '#utils/rolls/resultChanges.ts';
import { signedNumber, spacedSignedNumber } from '#utils/signedNumber.ts';

interface ResultChangeLinesInput {
	changes: readonly ResultChange[];
	rollTotal: number;
	speakerUuid: string;
	documentName: (uuid: string) => string | null | undefined;
	canRemove: (actorUuid: string, change: ResultChange) => boolean;
}

function totalWithTrueMinus(value: number): string {
	return value < 0 ? signedNumber(value) : String(value);
}

function statAbbreviation(stat: string): string {
	return localize(`NIMBLE.abilityScoreAbbreviations.${stat}`).toUpperCase();
}

/** A stat with the modifier it gives: "DEX +2", "INT +0", "WIL −1". */
function statChoiceLabel(choice: { stat: string; mod: number }): string {
	return `${statAbbreviation(choice.stat)} ${signedNumber(choice.mod)}`;
}

/** What an add puts on the total: "+3 STR", "−1 STR", or "+2" for no stat. */
function resultAmount(use: Pick<ResultUse, 'value' | 'stat'>): string {
	const amount = signedNumber(use.value);
	if (!use.stat) return amount;
	return `${amount} ${statAbbreviation(use.stat)}`;
}

function addedVerb(amount: string, wounds: number): string {
	if (wounds <= 0) return localize('NIMBLE.chat.incomingReactions.resultChange.added', { amount });
	return localize(
		wounds === 1
			? 'NIMBLE.chat.incomingReactions.resultChange.addedWithWound'
			: 'NIMBLE.chat.incomingReactions.resultChange.addedWithWounds',
		{ amount, count: String(wounds) },
	);
}

function lineVerb(
	clicks: readonly ResultChange[],
	before: number,
	documentName: ResultChangeLinesInput['documentName'],
): string {
	const [first] = clicks;
	if (first.change === 'succeed') {
		return localize('NIMBLE.chat.incomingReactions.resultChange.succeeded');
	}
	if (first.change === 'noDamage') {
		return localize('NIMBLE.chat.incomingReactions.resultChange.noDamage', {
			target: (documentName(first.targetTokenUuid ?? '') ?? '').trim(),
		});
	}
	if (first.change === 'countsAsNat20') {
		return localize('NIMBLE.chat.incomingReactions.resultChange.countsAsNat20');
	}
	if (first.change === 'setTotal') {
		return localize('NIMBLE.chat.incomingReactions.resultChange.changed', {
			before: String(before),
			value: String(first.value),
		});
	}
	const value = clicks.reduce((sum, click) => sum + click.value, 0);
	const wounds = clicks.reduce((sum, click) => sum + click.paid.wounds, 0);
	return addedVerb(resultAmount({ value, stat: first.stat }), wounds);
}

/** The card's Change a Result lines, in the order of their first clicks. */
function resultChangeLines(input: ResultChangeLinesInput): ResultChangeLine[] {
	const lines = new Map<string, { clicks: ResultChange[]; before: number }>();
	let total = input.rollTotal;
	for (const change of input.changes) {
		const before = change.retired ? (change.before ?? 0) : total;
		if (!change.retired) total = resultTotal(total, [change]);
		const line = lines.get(change.lineId);
		if (line) line.clicks.push(change);
		else lines.set(change.lineId, { clicks: [change], before });
	}

	return [...lines].map(([id, { clicks, before }]) => {
		const [first] = clicks;
		const verb = lineVerb(clicks, before, input.documentName);
		const feature = (input.documentName(first.itemUuid) ?? '').trim() || first.label;
		const name =
			first.actorUuid === input.speakerUuid
				? ''
				: (input.documentName(first.actorUuid) ?? '').trim();
		return {
			id,
			verb,
			withFeature: localize('NIMBLE.chat.incomingReactions.changeThisRoll.withFeature', {
				feature,
			}),
			sentence: localize('NIMBLE.chat.incomingReactions.changeThisRoll.sentence', {
				verb,
				feature,
			}),
			detail: name ? localize('NIMBLE.chat.incomingReactions.rerollUsedBy', { name }) : null,
			retired: first.retired,
			canRemove: input.canRemove(first.actorUuid, first),
		};
	});
}

/**
 * How the total came from the roll: "7 + 3 + 3 = 13". Null when the total is the
 * roll's, and for one set total, because its history line tells both numbers.
 */
function resultSumText(rollTotal: number, changes: readonly ResultChange[]): string | null {
	const standing = standingResultChanges(changes);
	if (standing.length === 1 && standing[0].change === 'setTotal') return null;
	if (resultTotal(rollTotal, changes) === rollTotal) return null;

	let text = totalWithTrueMinus(rollTotal);
	let total = rollTotal;
	let openSum = false;
	const closeSum = () => {
		if (!openSum) return;
		text = localize('NIMBLE.chat.incomingReactions.resultChange.sum', {
			sum: text,
			total: totalWithTrueMinus(total),
		});
		openSum = false;
	};
	for (const change of standingResultChanges(changes)) {
		if (change.change === 'add') {
			text += ` ${spacedSignedNumber(change.value)}`;
			openSum = true;
		} else if (change.change === 'setTotal') {
			closeSum();
			text = localize('NIMBLE.chat.incomingReactions.resultChange.changedTo', {
				from: text,
				to: totalWithTrueMinus(change.value),
			});
		} else if (change.change === 'countsAsNat20') {
			const modifier = change.value - NATURAL_20;
			text = localize('NIMBLE.chat.incomingReactions.resultChange.countsAsNat20Sum', {
				rolled: text,
				modifier: spacedSignedNumber(modifier),
			});
			openSum = true;
		}
		total = resultTotal(total, [change]);
	}
	closeSum();
	return text;
}

export { resultAmount, resultChangeLines, resultSumText, statAbbreviation, statChoiceLabel };
