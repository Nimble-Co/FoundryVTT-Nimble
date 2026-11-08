/** One condition that changes the roll mode of a roll. */
export interface ConditionRollMode {
	/** Stable for the roll: `${side}:${condition}`. */
	key: string;
	condition: string;
	/** Whose condition it is: the one who rolls, or the attack's target. */
	side: 'self' | 'target';
	/** +1 is one advantage, -1 one disadvantage. */
	step: number;
	/** Ticked when the roll window opens, and used when no window opens. */
	on: boolean;
	/** The name of the creature with the condition. */
	name: string;
	/** What the table decides, which the line names. */
	ask?: 'fearNearby' | 'taunter';
	/** The condition ends after the attack that used the line. */
	ends?: boolean;
}

/**
 * Per ticked key, what the tick really moved the slider. The ends of the
 * slider can take part of a value, and an untick gives back only what the tick took.
 */
export type AppliedTicks = Record<string, number>;
