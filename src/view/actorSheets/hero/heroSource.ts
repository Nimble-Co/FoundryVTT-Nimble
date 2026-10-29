import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SaveKeyType } from '#types/saveKey.js';
import type { SkillKeyType } from '#types/skillKey.js';
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
	};
	/** skill key to the key of its ability */
	skillAbilities: Partial<Record<SkillKeyType, AbilityKeyType>>;
	dicePools: DicePoolLike[];
	chargePools: ChargePoolLike[];
}

export interface HeroSource {
	actor: HeroActorLike;
	context: HeroSheetContext;
}
