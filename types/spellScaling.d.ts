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
	| 'raiseEffectRule';

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
	/** `raiseEffectRule`: the number field of that rule that goes up. */
	ruleField?: string | null;
}

/** What an upcast adds to a number field of one rule of an Apply Effect node's effect. */
export interface RuleRaise {
	ruleId: string;
	field: string;
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
