import type { ROLL_STATS } from '#utils/reroll/rollStat.ts';

export type RollStat = (typeof ROLL_STATS)[number];

/** One stat a player can pick for a new roll, with the modifier it gives. */
export interface StatChoice {
	stat: RollStat;
	mod: number;
}
