import type {
	IncomingReactionEntry,
	RerollDieResult,
	RerollRecord,
	RollChange,
} from './incomingReactionEntry.js';
import { payRerollCost, refundRerollCost, rerollUsesLeft } from './rerollCost.js';
import type { RerollRuleLike } from './rerollEntries.js';
import { prepareReroll, type RerollChanges } from './rerollOptions.js';
import type { RerollRollKind } from './rollToReroll.js';

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
	/** Gives back the cost this reroll paid, for a caller that cannot use the new roll. */
	refund: () => Promise<void>;
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
	makeRoll: (
		formula: string,
		options: Record<string, unknown>,
		changes?: Partial<RerollChanges>,
	) => Promise<TRoll>;
	/** Roll changes of Modify Reroll rules that this card has not applied yet. */
	rollChanges?: readonly RollChange[];
	/** The kind of roll being rerolled; attack changes apply only to an attack. */
	rollKind: RerollRollKind;
	/** Reads the new roll's kept die. By default, the primary die of a damage roll. */
	readNewDie?: (roll: TRoll) => RolledDie;
	/** An earlier reroll of this roll kept the crit triggers. */
	earlierCritTriggers: boolean;
	payOptions?: { forceHeroicReaction?: boolean };
	/** Puts the new roll in place. A throw here gives the cost back too. */
	place?: (done: RerollStepDone<TRoll>) => Promise<void>;
}

/** A roll's kept die: its size and result, each null when it cannot be read. */
interface RolledDie {
	faces: number | null;
	value: number | null;
	/** The other result of a die rolled two times for advantage or disadvantage. */
	dropped?: number | null;
}

interface NewRoll {
	primaryDie?: { faces?: number | null } | null;
	primaryDieValue?: number;
	isCritical?: boolean;
	isMiss?: boolean;
}

function primaryDieOf(roll: NewRoll): RolledDie {
	return { faces: roll.primaryDie?.faces ?? null, value: roll.primaryDieValue ?? null };
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
	const refund = async () => {
		if (cost && paid) await refundRerollCost(payer, cost, paid);
	};

	try {
		const rollChanges = [...(input.rollChanges ?? [])];
		const ruleChanges: Partial<RerollChanges> = rule.rerollChanges?.(input.rollKind) ?? {};
		const changes = {
			...ruleChanges,
			rollModeChange:
				(Number(ruleChanges.rollModeChange) || 0) +
				rollChanges.reduce((sum, c) => sum + (c.kind === 'rollMode' ? c.value : 0), 0),
		};
		const next = prepareReroll(
			replaced.originalFormula ?? replaced.formula ?? '',
			replaced.options as Record<string, unknown> | null | undefined,
			changes,
		);
		const roll = await input.makeRoll(next.formula, next.options, changes);
		const rolled = roll as NewRoll;
		const die = input.readNewDie ? input.readNewDie(roll) : primaryDieOf(rolled);
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
				faces: die.faces,
				previous: dieResult(input.previousResult, replaced),
				next: dieResult(die.value, rolled),
				usesLeft: cost ? rerollUsesLeft(payer, cost) : null,
				woundsGained: paid?.wounds ?? 0,
				dropped: die.dropped ?? null,
				changes: rollChanges,
			},
			discardedCritTriggers:
				input.earlierCritTriggers || (rule.discardedCritTriggers === true && previousWasCritical),
			refund,
		};
		await input.place?.(done);
		return done;
	} catch (error) {
		await refund();
		return { status: 'failed', error };
	}
}

export {
	rerollWithRule,
	type ReplacedRoll,
	type RerollHistory,
	type RolledDie,
	type RerollStepDone,
	type RerollStepInput,
	type RerollStepOutcome,
};
