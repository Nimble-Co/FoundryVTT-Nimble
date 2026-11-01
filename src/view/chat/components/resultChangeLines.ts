import type { ResultChange, ResultUse } from '#utils/incomingReactions/incomingReactionEntry.ts';

import localize from '#utils/localize.js';
import { resultTotal, standingResultChanges } from '#utils/rolls/resultChanges.ts';

const TRUE_MINUS = '−';

/** One history line of Change a Result. Repeats of one add are one line. */
interface ResultChangeLine {
	/** The line id of its clicks, which Remove asks for. */
	id: string;
	/** What it did: "Added +6 STR, Gained 2 Wounds". */
	verb: string;
	/** "with Mighty Soul". */
	withFeature: string;
	/** The line as a sentence, for its Remove button. */
	sentence: string;
	/** Who used it, when not the one who rolled. */
	detail: string | null;
	/** A new roll took it off: the line stays, with no Remove. */
	retired: boolean;
	canRemove: boolean;
}

interface ResultChangeLinesInput {
	changes: readonly ResultChange[];
	rollTotal: number;
	speakerUuid: string;
	documentName: (uuid: string) => string | null | undefined;
	canRemove: (actorUuid: string) => boolean;
}

function signedWithTrueMinus(value: number): string {
	return value < 0 ? `${TRUE_MINUS}${Math.abs(value)}` : `+${value}`;
}

/** What an add puts on the total: "+3 STR", "−1 STR", or "+2" for no stat. */
function resultAmount(use: Pick<ResultUse, 'value' | 'stat'>): string {
	const amount = signedWithTrueMinus(use.value);
	if (!use.stat) return amount;
	return `${amount} ${localize(`NIMBLE.abilityScoreAbbreviations.${use.stat}`).toUpperCase()}`;
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

function lineVerb(clicks: readonly ResultChange[], before: number): string {
	const [first] = clicks;
	if (first.change === 'succeed') {
		return localize('NIMBLE.chat.incomingReactions.resultChange.succeeded');
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
		const verb = lineVerb(clicks, before);
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
			canRemove: !first.retired && input.canRemove(first.actorUuid),
		};
	});
}

/**
 * How the total came from the roll: "7 + 3 + 3 = 13", or "7 changed to 13" for a
 * set total. Null when the total is the roll's.
 */
function resultSumText(rollTotal: number, changes: readonly ResultChange[]): string | null {
	if (resultTotal(rollTotal, changes) === rollTotal) return null;

	let text = String(rollTotal);
	let total = rollTotal;
	let openSum = false;
	const closeSum = () => {
		if (!openSum) return;
		text = localize('NIMBLE.chat.incomingReactions.resultChange.sum', {
			sum: text,
			total: String(total),
		});
		openSum = false;
	};
	for (const change of standingResultChanges(changes)) {
		if (change.change === 'add') {
			text += ` ${change.value < 0 ? TRUE_MINUS : '+'} ${Math.abs(change.value)}`;
			total += change.value;
			openSum = true;
		} else if (change.change === 'setTotal') {
			closeSum();
			text = localize('NIMBLE.chat.incomingReactions.resultChange.changedTo', {
				from: text,
				to: String(change.value),
			});
			total = change.value;
		}
	}
	closeSum();
	return text;
}

export { resultAmount, resultChangeLines, resultSumText, type ResultChangeLine };
