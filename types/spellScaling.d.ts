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
	| 'addCondition';

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
	appliedDeltas: ScalingDelta[];
}
