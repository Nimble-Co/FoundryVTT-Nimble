type EffectNode =
	| ConditionNode
	| DamageNode
	| DamageOutcomeNode
	| HealingNode
	| SavingThrowNode
	| TextNode;

type ActionConsequence = {
	criticalHit?: EffectNode[];
	hit?: EffectNode[];
	failedSave?: EffectNode[];
	failedSaveBy?: Record<number, EffectNode[]>;
	miss?: EffectNode[];
	passedSave?: EffectNode[];
};

type ConditionNode = {
	id: string;
	type: 'condition';
	condition: string;
	parentContext: string | null;
	parentNode: string | null;
};

type DamageNode = {
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

type DamageOutcomeNode = {
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

type HealingNode = {
	id: string;
	type: 'healing';
	healingType: 'healing' | 'temporaryHealing';
	formula: string;
	parentContext: string | null;
	parentNode: string | null;
	roll?: Record<string, any>;
};

type SavingThrowNode = {
	id: string;
	type: 'savingThrow';
	saveDC?: number;
	savingThrowType: 'strength' | 'dexterity' | 'intelligence' | 'will';
	sharedRolls?: DamageNode[];
	on?: ActionConsequence;
	parentContext: string | null;
	parentNode: string | null;
};

type TextNode = {
	id: string;
	type: 'note';
	noteType: 'flavor' | 'general' | 'reminder' | 'warning';
	text: string;
	parentContext: string | null;
	parentNode: string | null;
};
