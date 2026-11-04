import type { DieRef } from '../src/dice/oneDieReroll.ts';

/** What the player picked for a reroll or a die change. */
export interface RerollPick {
	/** The die the player picked. */
	die?: DieRef | null;
	/** A change only: the face the player set the die to. */
	value?: number | null;
	/** The stat the player picked for the new roll. */
	stat?: string | null;
	/** The dice the player picked, for a rule that rerolls several. */
	dice?: DieRef[] | null;
}
