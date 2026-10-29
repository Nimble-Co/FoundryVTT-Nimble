import type { SaveKeyType } from '#types/saveKey.js';
import type { PoolRecovery } from '../shared/poolRecovery.ts';
import type { PortraitFlags } from '../shared/portrait.ts';
import type {
	ConditionLike,
	EffectLike,
	Format,
	ItemLike,
	Localize,
} from '../shared/sheetSource.ts';

/** The three actor types that the NPC sheet shows. */
export type MonsterType = 'npc' | 'soloMonster' | 'minion';

export interface MonsterSave {
	mod: number;
	/** stacked advantage (positive) or disadvantage (negative) from rules */
	defaultRollMode: number;
}

/** An item of the monster, with its place in the hand-sorted order. */
export interface MonsterItemLike extends ItemLike {
	sort: number;
}

export interface MonsterActorLike {
	id: string;
	name: string;
	img: string;
	type: MonsterType;
	system: {
		savingThrows: Partial<Record<SaveKeyType, MonsterSave>>;
		attributes: {
			hp: { value: number; max: number; temp: number };
			/** none, medium or heavy */
			armor: string;
			movement: Record<string, number>;
			sizeCategory: string;
			damageResistances: string[];
			damageImmunities: string[];
			damageVulnerabilities: string[];
		};
		conditionImmunities: string[];
		/** `level` is a string: "1/3" is a level */
		details: { level: string; creatureType: string; isFlunky: boolean };
		/** the notes, as HTML */
		description: string;
		currency: Record<string, number>;
	};
	flags: PortraitFlags & {
		/** absent = on */
		automaticallyExecuteAvailableMacros?: boolean;
	};
	items: MonsterItemLike[];
	effects: EffectLike[];
}

/** A charge pool that an ability spends from (`getPoolsForItem`). */
export interface MonsterItemPool {
	current: number;
	max: number;
	per: PoolRecovery | null;
}

export interface MonsterSheetContext {
	localize: Localize;
	format: Format;
	/** the user may change the monster: an owner, and not in a compendium */
	editable: boolean;
	/** key to name, as Foundry shows it (world renames included) */
	labels: {
		conditions: Record<string, string>;
		damageTypes: Record<string, string>;
		sizes: Record<string, string>;
	};
	/** every condition of the system, A to Z, with the ones on the monster marked */
	conditions: ConditionLike[];
	/** by item id; empty until charge pools run on NPC actors */
	itemPools: Record<string, MonsterItemPool[]>;
	/** the notes as Foundry enriches them, for the editor while it is closed */
	enrichedNotes: string;
	/** by item id, the description as Foundry enriches it; only items that show their text have one */
	enrichedDescriptions: Record<string, string>;
	/** the import credit line, as HTML; empty when the monster was not imported */
	importCredit: string;
}

export interface MonsterSource {
	actor: MonsterActorLike;
	context: MonsterSheetContext;
}
