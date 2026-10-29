import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
import type { HeroicReactionKey } from '#utils/incomingReactions/heroicActions.js';
import type {
	ChargePoolLike,
	DicePoolLike,
	EffectLike,
	Format,
	ItemLike,
	Localize,
} from '../shared/sheetSource.ts';

export interface RolledValue {
	mod: number;
	/** stacked advantage (positive) or disadvantage (negative) from rules */
	defaultRollMode: number;
}

export interface HeroActorLike {
	id: string;
	name: string;
	img: string;
	system: {
		abilities: Record<AbilityKeyType, RolledValue>;
		savingThrows: Partial<Record<SaveKeyType, RolledValue>>;
		skills: Record<SkillKeyType, RolledValue>;
		attributes: {
			hp: { value: number; max: number; temp: number };
			wounds: { value: number; max: number };
			armor: { value: number };
			initiative: RolledValue;
			movement: Record<string, number>;
			sizeCategory: string;
			hitDice: Record<string, { current: number; bonus?: number }>;
			bonusHitDice: { size: number; value: number }[];
			hitDiceSizeBonus: number;
			damageResistances: string[];
			damageImmunities: string[];
			damageVulnerabilities: string[];
		};
		proficiencies: { languages: string[]; armor: string[]; weapons: string[] };
		resources: { mana: { current: number; max: number; baseMax: number } };
		levelUpHistory: unknown[];
		conditionImmunities: string[];
	};
	flags: {
		showPassiveSkillScores?: boolean;
		actorImageXOffset?: number;
		actorImageYOffset?: number;
		actorImageScale?: number;
		/** the groups of the Spells tab; none = by tier */
		spellsBy?: 'tier' | 'school';
	};
	items: ItemLike[];
	effects: EffectLike[];
}

export interface HeroCombatState {
	initiativeRolled: boolean;
	/** a roll is on its way: the button waits */
	initiativePending: boolean;
	isTurn: boolean;
	actions: {
		current: number;
		/** the actions of a turn, with the extra actions */
		effectiveMax: number;
		/** the next turn starts with this many more (or fewer) actions */
		pendingDelta: number;
		/** an extra action stays inside the limit of a turn */
		mayAdd: boolean;
	};
	/** the heroic reactions that the hero used this round */
	reactionsSpent: HeroicReactionKey[];
}

/** When the uses of a pool come back. Turn start and turn end both read "round". */
export type PoolRecovery = 'round' | 'safeRest' | 'fieldRest' | 'encounter';

/** A charge pool that an item has or spends from (`getPoolsForItem`, hidden pools left out). */
export interface ItemPoolLike {
	id: string;
	label: string;
	current: number;
	max: number;
	/** the charges that one use of the item spends */
	need: number;
	per: PoolRecovery | null;
}

/** Why the charge gate (`validateItemChargeConsumption`) stops a use. */
export interface ChargeGateLike {
	code: 'poolMissing' | 'insufficientCharges' | 'conflictingConsumers' | 'unofferableSpend';
	poolLabel: string;
	poolMax: number;
	per: PoolRecovery | null;
}

/** A `diceConsumer` rule in manual mode: you pick dice from its pool to spend. */
export interface DiceConsumerLike {
	ruleId: string;
	poolId: string;
	/** the rule label, or the item name */
	label: string;
	/** the most dice that one spend takes; null for no limit */
	cap: number | null;
	/** the outcome raises a die to its top face, so a die already at the top cannot be picked */
	maximize: boolean;
}

/** What the system works out for one item, beyond its own fields. */
export interface HeroItemState {
	/** actions that one use spends, with the action cost rules; 0 for no action cost */
	actionCost: number;
	pools: ItemPoolLike[];
	/** null: the gate lets the use go, or resource spending is off */
	gate: ChargeGateLike | null;
	/** the item has a toggle effect rule; on = its effect is on the hero */
	toggle: { ruleId: string; on: boolean } | null;
	diceConsumers: DiceConsumerLike[];
}

export interface HeroSheetContext {
	localize: Localize;
	format: Format;
	/** null: the actor has no combatant in the combat of this scene */
	combat: HeroCombatState | null;
	/** mana comes only when you roll Initiative */
	manaFromInitiative: boolean;
	/** the levels with a choice that the hero did not make */
	missingLevelSelections: number[];
	/** key to name, as Foundry shows it (world renames included) */
	labels: {
		conditions: Record<string, string>;
		damageTypes: Record<string, string>;
		languages: Record<string, string>;
		armorTypes: Record<string, string>;
		spellSchools: Record<string, string>;
	};
	/** skill key to the key of its ability */
	skillAbilities: Partial<Record<SkillKeyType, AbilityKeyType>>;
	dicePools: DicePoolLike[];
	chargePools: ChargePoolLike[];
	/** by item id; an item with no entry has no cost, pools, gate, toggle or consumers */
	itemState: Record<string, HeroItemState>;
	/** the names of the tokens that the user targets, not the hero */
	targets: string[];
	/** the damage formula of an Unarmed Strike, with its bonuses */
	unarmedDamage: string;
}

export interface HeroSource {
	actor: HeroActorLike;
	context: HeroSheetContext;
}
