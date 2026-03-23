/**
 * System data structure for spell items
 */
export interface SpellSystemData {
	tier: number;
	school: string;
	activation: {
		cost: { type: string; quantity: number };
		targets: { count: number };
		acquireTargetsFromTemplate: boolean;
		effects?: unknown[];
	};
	properties: {
		selected: string[];
		range?: { max?: number };
		reach?: { max?: number };
	};
}

/**
 * Represents a spell's damage or healing effect
 */
export interface SpellEffect {
	formula: string;
	isHealing: boolean;
}

/**
 * Props for the SpellReferenceCard component
 */
export interface SpellReferenceCardProps {
	spell: Item;
}

/**
 * Computed spell display data returned by createSpellCardState
 */
export interface SpellCardDisplayData {
	tier: number;
	requiresConcentration: boolean;
	meta: string | null;
	effect: SpellEffect | null;
	spellRange: string | null;
	targetType: string | null;
}
