import type { RollChange } from '../incomingReactions/incomingReactionEntry.js';
import { newRollChanges } from './modifyReroll.js';
import type { AutomaticReroll, RerollingActor } from './rerollEntries.js';
import { type RerollStepDone, type RerollStepInput, rerollWithRule } from './rerollStep.js';
import { applyGrants, grantsForUse } from './rerollUseGrants.js';
import type { RollUseKind } from './rollToReroll.js';

/** The roll an automatic Reroll replaces, and how to make its new roll. */
type AutomaticRerollTarget<TRoll> = Pick<
	RerollStepInput<TRoll>,
	'replaced' | 'previousResult' | 'makeRoll' | 'readNewDie'
>;

/** Where a chain of automatic Rerolls reads its roll and puts each new one. */
interface AutomaticRerollChain<TRoll, TTarget extends AutomaticRerollTarget<TRoll>> {
	rollKind: RollUseKind;
	/** The creature whose roll it is; grants are read for it. */
	roller: RerollingActor | null | undefined;
	/** The next automatic Reroll the roll that stands now allows, or null. */
	next(): AutomaticReroll | null;
	/** The roll the next Reroll replaces, or null when there is none. */
	target(next: AutomaticReroll): TTarget | null;
	/** The Modify Reroll changes the roll already has. */
	appliedRollChanges(): readonly RollChange[];
	earlierCritTriggers(): boolean;
	/** Put the new roll in place of the old one. A throw gives the cost back. */
	place(
		done: RerollStepDone<TRoll>,
		next: AutomaticReroll,
		target: TTarget,
		added: RollChange[],
	): Promise<void>;
}

/**
 * Run each automatic Reroll the roll allows, one after the other, until none
 * is left. The second result stands each time. A Reroll that fails is logged
 * and ends the chain; the Rerolls before it stay.
 */
async function chainAutomaticRerolls<TRoll, TTarget extends AutomaticRerollTarget<TRoll>>(
	chain: AutomaticRerollChain<TRoll, TTarget>,
): Promise<void> {
	for (let next = chain.next(); next; next = chain.next()) {
		const step = next;
		const target = chain.target(step);
		if (!target) return;
		try {
			const added = await newRollChanges(step.rule, chain.rollKind, chain.appliedRollChanges());
			const result = await rerollWithRule<TRoll>({
				rule: step.rule,
				entry: step.entry,
				rollKind: chain.rollKind,
				rollChanges: added,
				automatic: true,
				payer: step.rule.actor as Actor | null | undefined,
				replaced: target.replaced,
				previousResult: target.previousResult,
				makeRoll: (formula, options, changes) => target.makeRoll(formula, options, changes),
				readNewDie: target.readNewDie?.bind(target),
				earlierCritTriggers: chain.earlierCritTriggers(),
				place: async (done) => {
					const grants = await grantsForUse(step.rule, chain.roller);
					if (grants.length > 0) done.reroll.grants = grants;
					await chain.place(done, step, target, added);
				},
			});
			if (result.status === 'failed') throw result.error;
			if (result.status !== 'done') return;
			await applyGrants(result.reroll.grants ?? [], step.rule.item?.uuid ?? '');
		} catch (error) {
			console.error('Nimble | An automatic reroll failed.', error);
			return;
		}
	}
}

export { type AutomaticRerollChain, type AutomaticRerollTarget, chainAutomaticRerolls };
