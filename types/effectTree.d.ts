export type EffectNode =
	| ConditionNode
	| DamageNode
	| DamageOutcomeNode
	| HealingNode
	| PoolNode
	| SavingThrowNode
	| TextNode;

export type PoolNode = {
	id: string;
	type: 'pool';
	poolType: 'dice' | 'charge';
	action: 'rollDie' | 'rollPool' | 'fillCount' | 'clear';
	poolIdentifier: string;
	value: number;
	predicate?: Record<string, unknown>;
	/**
	 * When true, the underlying roll helper does NOT post a separate chat
	 * card for the roll. Use when the feature's own activation card already
	 * displays the rolled faces (e.g. Rage's Fury Dice), to avoid a duplicate
	 * "<pool> 1dN -> N" message stacking on top of the feature card.
	 * Only meaningful for `rollDie` / `rollPool` actions.
	 */
	suppressChat?: boolean;
	parentContext: string | null;
	parentNode: string | null;
	result?: {
		applied: boolean;
		skipReason?: 'predicate' | 'invalidAction' | 'unknownPool' | 'noActor';
		poolLabel?: string;
		previousCount?: number;
		newCount?: number;
		rolledFaces?: number[];
	} | null;
};

export type ActionConsequence = {
	criticalHit?: EffectNode[];
	hit?: EffectNode[];
	failedSave?: EffectNode[];
	failedSaveBy?: Record<number, EffectNode[]>;
	miss?: EffectNode[];
	passedSave?: EffectNode[];
};

export type ConditionNode = {
	id: string;
	type: 'condition';
	condition: string;
	parentContext: string | null;
	parentNode: string | null;
};

export type EffectNodeDisposition = 'any' | 'friendly' | 'neutral' | 'hostile' | 'secret';

export type DamageNode = {
	id: string;
	type: 'damage';
	damageType: string;
	formula: string;
	canCrit?: boolean;
	canMiss?: boolean;
	ignoreArmor?: boolean;
	ignoreAllies?: boolean;
	targetDisposition?: EffectNodeDisposition;
	on?: ActionConsequence;
	parentContext: string | null;
	parentNode: string | null;
	roll?: Record<string, any>;
	rollMode?: number;
};

export type DamageOutcomeNode = {
	id: string;
	type: 'damageOutcome';
	damageType?: string;
	ignoreArmor?: boolean;
	ignoreAllies?: boolean;
	outcome: 'fullDamage' | 'halfDamage';
	roll?: Record<string, any>;
	parentContext: string;
	parentNode: string;
};

export type HealingNode = {
	id: string;
	type: 'healing';
	healingType: 'healing' | 'tempHealing';
	formula: string;
	targetDisposition?: EffectNodeDisposition;
	parentContext: string | null;
	parentNode: string | null;
	roll?: Record<string, any>;
};

export type SavingThrowNode = {
	id: string;
	type: 'savingThrow';
	saveDC?: number;
	/** @deprecated Use savingThrowType instead */
	saveType?: 'strength' | 'dexterity' | 'intelligence' | 'will';
	savingThrowType: 'strength' | 'dexterity' | 'intelligence' | 'will';
	sharedRolls?: DamageNode[];
	on?: ActionConsequence;
	parentContext: string | null;
	parentNode: string | null;
	roll?: Record<string, unknown>;
};

export type TextNode = {
	id: string;
	type: 'note';
	noteType: 'flavor' | 'general' | 'reminder' | 'warning';
	text: string;
	parentContext: string | null;
	parentNode: string | null;
};
