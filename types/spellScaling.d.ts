export type ScalingMode = 'none' | 'upcast' | 'upcastChoice';

export type ScalingOperation =
	| 'addFlatDamage'
	| 'addDice'
	| 'addReach'
	| 'addRange'
	| 'addTargets'
	| 'addAreaSize'
	| 'addDC'
	| 'addArmor'
	| 'addDuration'
	| 'addCondition'
	| 'increaseDieSize'
	| 'raiseEffectRule'
	| 'lengthenLastsUntil';

export interface DiceValue {
	count: number;
	faces: number;
}

export interface ScalingDelta {
	operation: ScalingOperation;
	value: number | null;
	dice: DiceValue | null;
	condition: string | null;
	targetEffectId: string | null;
	durationType: string | null;
	/** Largest die size `increaseDieSize` may step up to; `null` means uncapped. */
	maxDieFaces: number | null;
	/** `raiseEffectRule`: the rule of the Apply Effect node's effect (`system.rules[].id`). */
	ruleId?: string | null;
	/** `raiseEffectRule`: the number field or formula field of that rule that goes up. */
	ruleField?: string | null;
	/** `raiseEffectRule` on a formula field: the formula added for each step. */
	formula?: string | null;
	/** `lengthenLastsUntil`: the index of the moment in the effect's Lasts Until. */
	momentIndex?: number | null;
}

/** What an upcast adds to a field of one rule of an Apply Effect node's effect. */
export interface RuleRaise {
	ruleId: string;
	field: string;
	/** A number field: what is added. */
	amount: number;
	/** A formula field: the term that is added once for each step. */
	formula?: string | null;
	steps?: number;
}

/** What an upcast adds to the number of one moment of an Apply Effect node's effect. */
export interface MomentRaise {
	index: number;
	amount: number;
}

export interface ScalingChoice {
	label: string;
	deltas: ScalingDelta[];
}

export interface SpellScaling {
	mode: ScalingMode;
	deltas: ScalingDelta[];
	choices: ScalingChoice[] | null;
}

export interface UpcastResult {
	isUpcast: boolean;
	manaSpent: number;
	upcastSteps: number;
	choiceIndex?: number;
	choiceLabel?: string;
	appliedDeltas: ScalingDelta[];
}
