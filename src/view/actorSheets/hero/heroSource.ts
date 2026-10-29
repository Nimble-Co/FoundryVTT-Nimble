import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
import type { HeroicReactionKey } from '#utils/incomingReactions/heroicActions.js';
import type { PoolRecovery } from '../shared/poolRecovery.ts';
import type {
	ChargePoolLike,
	ConditionLike,
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
			wounds: { value: number; max: number; bonus: number };
			armor: { value: number };
			initiative: RolledValue & { bonuses: string };
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
		resources: {
			mana: { current: number; max: number; baseMax: number };
			/** null: the tier comes from the spells that the hero has */
			highestUnlockedSpellTier: number | null;
			inspiration: boolean;
		};
		levelUpHistory: unknown[];
		conditionImmunities: string[];
		currency: Record<string, number>;
		inventory: {
			totalSlots: number;
			usedSlots: number;
			bonusSlots: number;
			/** by container id, in the units of its capacity */
			containerCapacityUsage: Record<string, number>;
		};
		details: { age: string; height: string; weight: string; gender: string; notes: string };
	};
	flags: {
		showPassiveSkillScores?: boolean;
		actorImageXOffset?: number;
		actorImageYOffset?: number;
		actorImageScale?: number;
		/** the groups of the Spells tab; none = by tier */
		spellsBy?: SpellsBy;
		/** absent = on */
		trackInventorySlots?: boolean;
		/** absent = on */
		includeCurrencyBulk?: boolean;
		/** absent = on */
		automaticallyExecuteAvailableMacros?: boolean;
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

/** How the Spells tab groups the spells. */
export type SpellsBy = 'tier' | 'school';

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
		/** the headings of the selection groups of a class; a group with no entry gets its key in Title Case */
		featureGroups: Record<string, string>;
	};
	/** every condition of the system, A to Z, with the ones on the hero marked */
	conditions: ConditionLike[];
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
	/** the Bio notes as Foundry enriches them, for the editor while it is closed */
	enrichedNotes: string;
	/** by item id, the description as Foundry enriches it; only rows that are open have one */
	enrichedDescriptions: Record<string, string>;
}

export interface HeroSource {
	actor: HeroActorLike;
	context: HeroSheetContext;
}
