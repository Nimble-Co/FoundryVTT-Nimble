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

export type DamageNode = {
	id: string;
	type: 'damage';
	damageType: string;
	formula: string;
	canCrit?: boolean;
	canMiss?: boolean;
	ignoreArmor?: boolean;
	ignoreAllies?: boolean;
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
