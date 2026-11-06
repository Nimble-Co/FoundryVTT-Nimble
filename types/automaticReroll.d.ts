import type { RerollStepInput } from '../src/utils/reroll/rerollStep.ts';

/** The roll an automatic Reroll replaces, and how to make its new roll. */
export type AutomaticRerollTarget<TRoll> = Pick<
	RerollStepInput<TRoll>,
	'replaced' | 'previousResult' | 'makeRoll' | 'readNewDie'
>;
