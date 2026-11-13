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
}

/**
 * Per ticked key, what the tick really moved the slider. The ends of the
 * slider can take part of a value, and an untick gives back only what the tick took.
 */
export type AppliedTicks = Record<string, number>;

/** An effect on a creature, as the condition lines read it. */
export interface ConditionEffect {
	statuses?: ReadonlySet<string>;
	origin?: string | null;
	disabled?: boolean;
	_stats?: { createdTime?: number | null } | null;
}

/** A creature whose conditions change a roll: the one who rolls, or the target. */
export interface ConditionCreature {
	name?: string | null;
	uuid?: string | null;
	getDomain?(): Set<string>;
	getTargetDomain?(): Set<string>;
	effects?: Iterable<ConditionEffect>;
	toggleStatusEffect?(statusId: string, options: { active: boolean }): Promise<unknown>;
}
