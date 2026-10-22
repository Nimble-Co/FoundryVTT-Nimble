import type {
	IncomingReactionEntry,
	RerollDieResult,
	RerollRecord,
} from './incomingReactionEntry.js';
import { payRerollCost, refundRerollCost, rerollUsesLeft } from './rerollCost.js';
import type { RerollRuleLike } from './rerollEntries.js';
import { prepareReroll } from './rerollOptions.js';

/** The roll a reroll replaces. A live roll and a serialized one both fit. */
interface ReplacedRoll {
	originalFormula?: string;
	formula?: string;
	isCritical?: boolean;
	isMiss?: boolean;
	options?: object | null;
}

/** The card's reroll history fields: the rerolls of its last action. */
interface RerollHistory {
	rerolls: RerollRecord[];
	discardedCritTriggers: boolean;
}

type RerollStepDone<TRoll> = {
	status: 'done';
	roll: TRoll;
	reroll: RerollRecord;
	discardedCritTriggers: boolean;
};

type RerollStepOutcome<TRoll> =
	| RerollStepDone<TRoll>
	| { status: 'unpaid' }
	| { status: 'failed'; error: unknown };

interface RerollStepInput<TRoll> {
	rule: RerollRuleLike;
	entry: IncomingReactionEntry;
	/** Pays the cost; its charges left go into the history. */
	payer: Actor | null | undefined;
	replaced: ReplacedRoll;
	/** The replaced roll's primary die result, read the way the caller reads it. */
	previousResult: number | null;
	makeRoll: (formula: string, options: Record<string, unknown>) => Promise<TRoll>;
	/** An earlier reroll of this roll kept the crit triggers. */
	earlierCritTriggers: boolean;
	payOptions?: { forceHeroicReaction?: boolean };
	/** Puts the new roll in place. A throw here gives the cost back too. */
	place?: (done: RerollStepDone<TRoll>) => Promise<void>;
}

interface NewRoll {
	primaryDie?: { faces?: number | null } | null;
	primaryDieValue?: number;
	isCritical?: boolean;
	isMiss?: boolean;
}

function dieResult(
	value: number | null | undefined,
	roll: { isCritical?: boolean; isMiss?: boolean },
): RerollDieResult | null {
	if (typeof value !== 'number') return null;
	if (roll.isCritical === true) return { value, outcome: 'crit' };
	return { value, outcome: roll.isMiss === true ? 'miss' : null };
}

/**
 * Reroll with a `reroll` rule: pay its cost, roll again with its changes, and
 * build the history. When anything after paying throws, the cost is given
 * back and the outcome is `failed`.
 */
async function rerollWithRule<TRoll>(
	input: RerollStepInput<TRoll>,
): Promise<RerollStepOutcome<TRoll>> {
	const { rule, entry, payer, replaced } = input;
	const cost = rule.rerollCost;
	const paid = cost ? await payRerollCost(payer, cost, input.payOptions) : null;
	if (cost && !paid) return { status: 'unpaid' };

	try {
		const next = prepareReroll(
			replaced.originalFormula ?? replaced.formula ?? '',
			replaced.options as Record<string, unknown> | null | undefined,
			rule.rerollChanges?.() ?? {},
		);
		const roll = await input.makeRoll(next.formula, next.options);
		const rolled = roll as NewRoll;
		const previousWasCritical = replaced.isCritical === true;
		const done: RerollStepDone<TRoll> = {
			status: 'done',
			roll,
			reroll: {
				entryId: entry.id,
				itemUuid: entry.itemUuid,
				ruleId: entry.ruleId,
				label: entry.label,
				actorUuid: entry.actorUuid,
				faces: rolled.primaryDie?.faces ?? null,
				previous: dieResult(input.previousResult, replaced),
				next: dieResult(rolled.primaryDieValue, rolled),
				usesLeft: cost ? rerollUsesLeft(payer, cost) : null,
				woundsGained: paid?.wounds ?? 0,
			},
			discardedCritTriggers:
				input.earlierCritTriggers || (rule.discardedCritTriggers === true && previousWasCritical),
		};
		await input.place?.(done);
		return done;
	} catch (error) {
		if (cost && paid) await refundRerollCost(payer, cost, paid);
		return { status: 'failed', error };
	}
}

export {
	rerollWithRule,
	type ReplacedRoll,
	type RerollHistory,
	type RerollStepDone,
	type RerollStepInput,
	type RerollStepOutcome,
};
