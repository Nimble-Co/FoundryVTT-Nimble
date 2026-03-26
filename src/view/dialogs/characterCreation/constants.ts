/**
 * Character creation stage identifiers
 *
 * Stages are numbered 0-8 with some having sub-stages (e.g., '0b', '1a', '1b')
 * to indicate optional or dependent steps within a main stage.
 */
export const CHARACTER_CREATION_STAGES = {
	/** Select a class */
	CLASS: 0,
	/** Class features granted at level 1 (optional sub-stage) */
	CLASS_FEATURES: '0b',
	/** Select an ancestry */
	ANCESTRY: '1a',
	/** Ancestry-specific options like size or save selection (optional sub-stage) */
	ANCESTRY_OPTIONS: '1b',
	/** Select a background */
	BACKGROUND: 2,
	/** Background-specific options like "Raised by" ancestry choice (optional sub-stage) */
	BACKGROUND_OPTIONS: '2b',
	/** Choose starting equipment or gold */
	STARTING_EQUIPMENT: 3,
	/** Select a stat array */
	ARRAY: 4,
	/** Assign ability scores from the array */
	STATS: 5,
	/** Assign skill points */
	SKILLS: 6,
	/** Select bonus languages (if INT modifier is positive) */
	LANGUAGES: 7,
	/** Final stage - ready to create character */
	SUBMIT: 8,
} as const;

export type CharacterCreationStage =
	(typeof CHARACTER_CREATION_STAGES)[keyof typeof CHARACTER_CREATION_STAGES];

/**
 * Default number of skill points to assign during character creation
 */
export const DEFAULT_SKILL_POINTS = 4;

/**
 * Total number of main stages for the progress bar
 */
export const TOTAL_MAIN_STAGES = 8;
