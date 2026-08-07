/** Types for the shared class-progression integration-test harness. */

/** A pool of features a class report claims are offered for selection at a level. */
export interface ReportPool {
	group: string;
	options: string[];
}

/** One level's worth of a class report's expected grants and choices. */
export interface ReportLevel {
	level: number;
	auto: string[];
	pools: ReportPool[];
	subclass: ReportPool[];
	asi: string | null;
}

/**
 * The full human-facing progression report a class-progression test asserts against —
 * what a character of this class looks like as it levels 1 -> 20. Each `*.expect.ts`
 * exports a `REPORT` of this shape; the test drives the real resolver and checks it
 * grants exactly what the report claims.
 */
export interface Report {
	name: string;
	id: string;
	hitDie: number;
	startingHp: number;
	keyAbilities: string[];
	savingThrows: { adv: string; dis: string };
	startingGear: string[];
	caster: boolean;
	manaFormula: string;
	subclasses: string[];
	subclassSelectLevel: number;
	levels: ReportLevel[];
}

export interface FeatureDoc {
	uuid: string;
	_id: string;
	type: 'feature';
	name: string;
	img: string;
	system: Record<string, any>;
}

export interface ClassMeta {
	name: string;
	identifier: string;
	hitDieSize: number;
	startingHp: number;
	keyAbilityScores: string[];
	savingThrows: { advantage: string; disadvantage: string };
	groupIdentifiers: string[];
	abilityScoreData: Record<string, { type: string; statIncreaseType: string }>;
	startingGear: string[];
	caster: boolean;
	manaFormula: string;
	subclassGroups: string[];
	subclassSelectLevel: number | null;
	raw: Record<string, any>;
}

/** A pool of features offered for selection at one level. */
export interface OfferedGroup {
	/** How many features the player must pick from this group at this level. */
	selectionCount: number;
	/** Names of the features available to pick (owned features already removed). */
	options: string[];
}

/** One `levelUpOptions` entry on a feature. */
export interface LevelUpOption {
	id?: string;
	label?: string;
	applyAtLevels?: number[];
	rules?: unknown[];
	selectionGroups?: string[];
	selectionCount?: number;
}

/**
 * A single #708 alternative offered at a level: "choose one option OR another". An
 * option may draw picks from the combined union of its `selectionGroups`, or carry
 * no pool at all (a flat rule like "+1 Max Combat Die").
 */
export interface OfferedOption {
	/** The progression feature presenting this option (e.g. "Fit for Any Battlefield"). */
	featureName: string;
	/** The option's display label (e.g. "Choose a Combat Ability"). */
	label?: string;
	/** Groups whose features form ONE combined pool for this option. */
	selectionGroups: string[];
	/** How many picks this option draws from its combined pool. */
	selectionCount: number;
	/** True when the option applies a flat rule instead of (or as well as) a pool pick. */
	hasRules: boolean;
}

/** What a character is offered / granted when leveling to a single level. */
export interface LevelSummary {
	level: number;
	/** Features newly auto-granted at this level (already-owned repeats removed). */
	newAutoGrants: string[];
	/**
	 * Every selectable pool offered at this level, keyed by group name — whether it
	 * surfaces as a plain selection group or is presented through a #708 option
	 * feature's picker. This is the "effective" set of choices the player sees.
	 *
	 * NOTE: when a #708 option combines several groups into ONE pick (e.g. Commander's
	 * "Choose a Combat Ability" spanning combat-tactics + commanders-orders), each group
	 * appears here separately, but only ONE pick total is drawn from their union — see
	 * `offeredOptions` for the authoritative per-choice picture.
	 */
	offeredGroups: Record<string, OfferedGroup>;
	/** #708 progression features that present an option picker at this level. */
	optionFeatureNames: string[];
	/** The #708 alternatives offered this level ("choose one OR another"). */
	offeredOptions: OfferedOption[];
	/** Ability-score increase type at this level, from the class definition, if any. */
	asi: string | null;
	/** True when this is the level the class first chooses a subclass. */
	isSubclassSelectLevel: boolean;
}
