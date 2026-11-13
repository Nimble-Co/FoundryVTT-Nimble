import type { HeldUsedUp } from './heldChange.d.ts';
import type { RuleRaise } from './spellScaling.d.ts';
import type { Moment } from '#utils/lastsUntil/momentReached.js';

export type EffectNode =
	| ApplyEffectNode
	| DamageNode
	| DamageOutcomeNode
	| EndConditionsNode
	| HealingNode
	| MoveNode
	| PoolNode
	| SavingThrowNode
	| TextNode
	| WoundNode;

/** Ends the effects that give a negative condition, or a listed one, on the targets or the user. */
export type EndConditionsNode = {
	id: string;
	type: 'endConditions';
	recipient: 'self' | 'targets';
	/** negative: every negative condition. listed: only `conditions`. */
	which: 'negative' | 'listed';
	conditions: string[];
	parentContext: string | null;
	parentNode: string | null;
};

/** Gives Wounds to the card's targets or to the one who used the item. */
export type WoundNode = {
	id: string;
	type: 'wound';
	/** A whole number, 1 or more. */
	amount: number;
	recipient: 'self' | 'targets';
	parentContext: string | null;
	parentNode: string | null;
};

/**
 * A Movement Offer: a Free Move or Forced Movement the card offers to the
 * recipient's owner as a guided drag. `distance` is a formula against the
 * source's roll data, with `@speed` as the recipient's walk speed.
 */
export type MoveNode = {
	id: string;
	type: 'move';
	kind: 'free' | 'forced';
	recipient: 'self' | 'targets';
	distance: string;
	/** Per-size overrides of `distance`, keyed by the recipient's size category. */
	distanceBySize: Record<string, string>;
	ignoreDifficultTerrain: boolean;
	/** The text says "up to" the distance. Unset: only a move for free does. */
	upTo?: boolean;
	direction: 'any' | 'away' | 'toward';
	/** Who the direction is away from or toward. Unset: the actor of the card. */
	sourceName?: string;
	parentContext: string | null;
	parentNode: string | null;
};

export type PoolNode = {
	id: string;
	type: 'pool';
	poolType: 'dice' | 'charge';
	action: 'rollDie' | 'rollPool' | 'fillCount' | 'clear' | 'maximizeDie';
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
		skipReason?:
			| 'predicate'
			| 'invalidAction'
			| 'unknownPool'
			| 'noActor'
			| 'poolEmpty'
			| 'allAtMax';
		poolLabel?: string;
		previousCount?: number;
		newCount?: number;
		rolledFaces?: number[];
		/** The dice pool's faces after the step. */
		faces?: number[];
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

/**
 * Puts an effect on the card's targets or on the one who used the item. The
 * effect is a `transfer: false` Active Effect on the same item (`effectId`), or,
 * for a card a rule or an upcast makes, a condition with its Lasts Until.
 */
export type ApplyEffectNode = {
	id: string;
	type: 'applyEffect';
	effectId: string | null;
	/** The item that has the effect, when it is not the card's item (a node that a rule gives). */
	effectItemUuid?: string | null;
	condition?: string | null;
	lastsUntil?: Moment[];
	/** `savers`: each creature whose save from the card has the result of the step's branch. */
	recipient: 'self' | 'targets' | 'savers';
	/** A temp healing node of the same card: the effect gives that temp HP and takes back what is left. */
	tempHealingNodeId?: string | null;
	/** What the upcast adds to number fields of the effect's rules. */
	ruleRaises?: RuleRaise[];
	parentContext: string | null;
	parentNode: string | null;
};

/** What a card shows of the effect: the item's effect, or the condition of a card a rule made. */
export interface ApplyEffectSource {
	name: string;
	img: string;
	lastsUntil: readonly Moment[];
	/** The attack that uses up its Held Roll rule. */
	usedUp?: HeldUsedUp | null;
	escape: boolean;
}

export type EffectNodeDisposition = 'any' | 'friendly' | 'neutral' | 'hostile' | 'secret';

export type DamageNode = {
	id: string;
	type: 'damage';
	damageType: string;
	formula: string;
	canCrit?: boolean;
	canMiss?: boolean;
	/**
	 * When true the activation leaves this damage unrolled and the card shows a
	 * Roll Damage button instead. For damage that lands on a later trigger than
	 * the activation itself, where rolling up front would put a number on the
	 * card for something that has not happened yet.
	 */
	deferredRoll?: boolean;
	/** What a tick in the roll window multiplies the damage by. */
	damageMultiplier?: number;
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
	damageMultiplier?: number;
	damageType?: string;
	targetDisposition?: EffectNodeDisposition;
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
	/** `self` goes to the one who used the item, with no target. Absent goes to the card's targets. */
	recipient?: 'self';
	targetDisposition?: EffectNodeDisposition;
	parentContext: string | null;
	parentNode: string | null;
	roll?: Record<string, any>;
};

export type SavingThrowNode = {
	id: string;
	type: 'savingThrow';
	/** A number or a formula. Empty: see `resolveSaveNodeDC`. */
	saveDC?: number | string;
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
