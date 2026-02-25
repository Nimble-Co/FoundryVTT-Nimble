/**
 * TypeScript types for D&D 5e statblock conversion
 */

import type {
	ActorType,
	BatchImportResult,
	ImportOptions,
	ImportResult,
	ParsedDamage,
	ParsedRangeReach,
	ParsedSaveType,
} from '../nimbleNexus/types.js';

// Re-export shared types for convenience
export type { ActorType, ImportOptions, ImportResult, BatchImportResult, ParsedSaveType };

// ─── Intermediate Format ─────────────────────────────────────────────────────
// Both JSON and text parsers produce this normalized shape.

export interface Dnd5eAbilityScore {
	score: number;
	mod: number;
}

export interface ParsedAttack {
	type: 'melee' | 'ranged' | 'melee_or_ranged';
	toHit: number;
	reach?: number; // in feet
	range?: number; // in feet
	longRange?: number; // in feet
	targets: string; // e.g. 'one target'
	damage: ParsedDamage[];
	riders?: string; // on-hit effect text
}

export interface Dnd5eStatblockTrait {
	name: string;
	description: string;
}

export interface Dnd5eStatblockAction {
	name: string;
	description: string;
	parsed?: ParsedAttack;
}

export interface Dnd5eSpellGroup {
	level: number; // 0 = cantrip
	slots?: number;
	names: string[];
}

export interface Dnd5eSpellcasting {
	ability?: string;
	dc?: number;
	attackBonus?: number;
	spells: Dnd5eSpellGroup[];
}

/**
 * Normalized 5e monster statblock — the intermediate format.
 * Both JSON ingest and text ingest produce this shape.
 */
export interface Dnd5eStatblock {
	name: string;
	size: string; // 'tiny'|'small'|'medium'|'large'|'huge'|'gargantuan'
	creatureType: string; // e.g. 'Dragon', 'Fiend'
	alignment?: string;
	ac: number;
	acSource?: string; // e.g. 'natural armor'
	hp: number;
	hitDice?: string; // e.g. '19d12+133'
	movement: Record<string, number>; // in feet: { walk: 40, fly: 80 }
	abilities: Record<string, Dnd5eAbilityScore>; // str/dex/con/int/wis/cha
	saveProficiencies: string[]; // e.g. ['dex', 'con', 'wis', 'cha']
	skills?: Record<string, number>;
	damageResistances: string[];
	damageImmunities: string[];
	damageVulnerabilities: string[];
	conditionImmunities: string[];
	senses: string[];
	languages: string[];
	cr: number;
	xp?: number;
	traits: Dnd5eStatblockTrait[];
	actions: Dnd5eStatblockAction[];
	bonusActions?: Dnd5eStatblockAction[];
	reactions?: Dnd5eStatblockTrait[];
	legendaryActions?: {
		preamble?: string;
		entries: Dnd5eStatblockTrait[];
	};
	lairActions?: Dnd5eStatblockTrait[];
	spellcasting?: Dnd5eSpellcasting;
	description?: string; // biography/flavor text
	sourceRaw: string; // original input for provenance
}

// ─── 5e Foundry JSON Input Types ─────────────────────────────────────────────
// Loose shape — users may paste partial data.

export interface Dnd5eJsonAbility {
	value?: number;
	proficient?: number; // 0 or 1
	mod?: number;
	save?: number;
}

export interface Dnd5eJsonMovement {
	walk?: number | string;
	fly?: number | string;
	swim?: number | string;
	climb?: number | string;
	burrow?: number | string;
	hover?: boolean;
	units?: string;
}

export interface Dnd5eJsonHP {
	value?: number;
	max?: number;
	formula?: string; // e.g. '12d10+60'
}

export interface Dnd5eJsonAC {
	flat?: number;
	calc?: string;
	formula?: string;
	value?: number;
}

export interface Dnd5eJsonDamageTraits {
	value?: string[];
	custom?: string;
	bypasses?: string[];
}

export interface Dnd5eJsonCreatureType {
	value?: string;
	subtype?: string;
	swarm?: string;
	custom?: string;
}

export interface Dnd5eJsonItem {
	name?: string;
	type?: string; // 'weapon', 'feat', 'spell', etc.
	system?: {
		description?: { value?: string };
		actionType?: string; // 'mwak', 'rwak', 'msak', 'rsak', 'save', 'other'
		attackBonus?: string | number;
		damage?: {
			parts?: [string, string][]; // [[formula, type], ...]
			versatile?: string;
		};
		range?: {
			value?: number | null;
			long?: number | null;
			units?: string;
		};
		target?: {
			value?: number | null;
			width?: number | null;
			units?: string;
			type?: string;
		};
		save?: {
			ability?: string;
			dc?: number | null;
			scaling?: string;
		};
		activation?: {
			type?: string; // 'action', 'bonus', 'reaction', 'legendary', 'lair', 'special'
			cost?: number;
			condition?: string;
		};
		uses?: {
			value?: number | null;
			max?: string;
			per?: string; // 'sr', 'lr', 'day', 'charges'
		};
		recharge?: {
			value?: number | null;
			charged?: boolean;
		};
	};
}

/** Top-level shape of pasted 5e actor JSON */
export interface Dnd5eActorJson {
	name?: string;
	type?: string; // 'npc'
	img?: string;
	system?: {
		abilities?: Record<string, Dnd5eJsonAbility>;
		attributes?: {
			ac?: Dnd5eJsonAC | { flat?: number; value?: number };
			hp?: Dnd5eJsonHP;
			movement?: Dnd5eJsonMovement;
			senses?: Record<string, number | string>;
		};
		traits?: {
			size?: string; // 'tiny', 'sm', 'med', 'lg', 'huge', 'grg'
			dr?: Dnd5eJsonDamageTraits;
			di?: Dnd5eJsonDamageTraits;
			dv?: Dnd5eJsonDamageTraits;
			ci?: { value?: string[]; custom?: string };
			languages?: { value?: string[]; custom?: string };
		};
		details?: {
			cr?: number;
			xp?: { value?: number };
			type?: Dnd5eJsonCreatureType | string;
			source?: string;
			biography?: { value?: string };
			alignment?: string;
		};
	};
	items?: Dnd5eJsonItem[];
}

// ─── Conversion Report Types ─────────────────────────────────────────────────

export type ReviewFlag = 'auto' | 'review' | 'skipped';

export interface ConversionField<T = unknown> {
	value: T;
	flag: ReviewFlag;
	source?: string; // original 5e text for provenance
	note?: string; // why flagged or what mapping was applied
}

export interface ConversionItemReport {
	name: string;
	flag: ReviewFlag;
	note?: string;
	itemData: object; // ready-to-use Nimble monsterFeature item
}

export interface SkippedItemReport {
	name: string;
	reason: string;
	originalText?: string;
}

export interface SpellMatchResult {
	spellName: string;
	flag: ReviewFlag;
	matchedNimbleName?: string;
	matchedItemUuid?: string;
	distance?: number; // Levenshtein distance (0 = exact)
}

export interface ConversionReport {
	name: ConversionField<string>;
	actorType: ConversionField<ActorType>;
	sizeCategory: ConversionField<string>;
	creatureType: ConversionField<string>;
	hp: ConversionField<number>;
	armor: ConversionField<string>;
	level: ConversionField<string>;
	movement: ConversionField<Record<string, number>>;
	damageResistances: ConversionField<string[]>;
	damageImmunities: ConversionField<string[]>;
	damageVulnerabilities: ConversionField<string[]>;
	savingThrows: ConversionField<Record<string, { defaultRollMode: number; mod: number }>>;
	description: ConversionField<string>;
	items: ConversionItemReport[];
	skippedItems: SkippedItemReport[];
	spellMatches: SpellMatchResult[];
	warnings: string[];
	sourceRaw: string;
	cr: number;
}

/** Result of a batch conversion (multiple monsters) */
export interface BatchConversionEntry {
	statblock: Dnd5eStatblock;
	report: ConversionReport;
}
