/**
 * Constants and mapping tables for D&D 5e → Nimble conversion
 */

// Re-export shared constants from NimbleNexus
export {
	DEFAULT_ACTOR_IMAGE,
	DEFAULT_FEATURE_ICONS,
	FEATURE_SUBTYPES,
	SIZE_TO_TOKEN_DIMENSIONS,
} from '../nimbleNexus/constants.js';

// ─── Size Mapping ────────────────────────────────────────────────────────────

/** 5e size codes (both short and long forms) to Nimble size strings */
export const DND5E_SIZE_MAP: Record<string, string> = {
	tiny: 'tiny',
	sm: 'small',
	small: 'small',
	med: 'medium',
	medium: 'medium',
	lg: 'large',
	large: 'large',
	huge: 'huge',
	grg: 'gargantuan',
	gargantuan: 'gargantuan',
};

// ─── AC → Armor Classification ───────────────────────────────────────────────

const AC_NONE_MAX = 12;
const AC_MEDIUM_MAX = 15;

export function classifyArmor(ac: number): { value: string; note: string } {
	if (ac <= AC_NONE_MAX) {
		return { value: 'none', note: `5e AC ${ac} → none (AC ≤ ${AC_NONE_MAX})` };
	}
	if (ac <= AC_MEDIUM_MAX) {
		return {
			value: 'medium',
			note: `5e AC ${ac} → medium (AC ${AC_NONE_MAX + 1}-${AC_MEDIUM_MAX})`,
		};
	}
	return { value: 'heavy', note: `5e AC ${ac} → heavy (AC ≥ ${AC_MEDIUM_MAX + 1})` };
}

// ─── Movement ────────────────────────────────────────────────────────────────

export const FEET_PER_SQUARE = 5;

export function feetToSquares(feet: number): number {
	return Math.round(feet / FEET_PER_SQUARE);
}

// ─── CR → Level ──────────────────────────────────────────────────────────────

export function crToLevel(cr: number): { level: string; note: string } {
	if (cr <= 0) return { level: '1/4', note: `CR ${cr} → level 1/4` };
	if (cr <= 0.125) return { level: '1/4', note: 'CR 1/8 → level 1/4' };
	if (cr <= 0.25) return { level: '1/4', note: 'CR 1/4 → level 1/4' };
	if (cr <= 0.5) return { level: '1/2', note: 'CR 1/2 → level 1/2' };
	const clamped = Math.min(Math.max(Math.round(cr), 1), 30);
	return { level: String(clamped), note: `CR ${cr} → level ${clamped} (1:1)` };
}

// ─── Save Mapping ────────────────────────────────────────────────────────────

/** Map 5e ability abbreviations to Nimble saving throw stats */
export const DND5E_SAVE_TO_NIMBLE: Record<string, string> = {
	str: 'strength',
	dex: 'dexterity',
	con: 'strength', // CON → STR (both physical)
	int: 'intelligence',
	wis: 'will', // WIS → Will
	cha: 'will', // CHA → Will
};

// ─── Action Type Mapping ─────────────────────────────────────────────────────

export const DND5E_ACTION_TYPE_MAP: Record<string, '' | 'reach' | 'range'> = {
	mwak: 'reach', // melee weapon attack
	rwak: 'range', // ranged weapon attack
	msak: 'reach', // melee spell attack
	rsak: 'range', // ranged spell attack
	save: '',
	other: '',
	util: '',
};

// ─── Damage Type Mapping ─────────────────────────────────────────────────────

/** Damage types shared between 5e and Nimble */
export const SHARED_DAMAGE_TYPES = new Set([
	'acid',
	'bludgeoning',
	'cold',
	'fire',
	'force',
	'lightning',
	'necrotic',
	'piercing',
	'poison',
	'psychic',
	'radiant',
	'slashing',
	'thunder',
]);

/** 5e damage types that need remapping (null = no equivalent) */
export const DND5E_DAMAGE_TYPE_MAP: Record<string, string | null> = {
	acid: 'acid',
	bludgeoning: 'bludgeoning',
	cold: 'cold',
	fire: 'fire',
	force: 'force',
	lightning: 'lightning',
	necrotic: 'necrotic',
	piercing: 'piercing',
	poison: 'poison',
	psychic: 'psychic',
	radiant: 'radiant',
	slashing: 'slashing',
	thunder: 'thunder',
	healing: null,
};

// ─── Condition Mapping ───────────────────────────────────────────────────────

/** 5e conditions that map directly to Nimble conditions */
export const DIRECT_CONDITION_MAP: Record<string, string> = {
	blinded: 'blinded',
	charmed: 'charmed',
	frightened: 'frightened',
	grappled: 'grappled',
	incapacitated: 'incapacitated',
	invisible: 'invisible',
	paralyzed: 'paralyzed',
	petrified: 'petrified',
	poisoned: 'poisoned',
	prone: 'prone',
	restrained: 'restrained',
	stunned: 'stunned',
	unconscious: 'unconscious',
};

/** 5e conditions that remap to different Nimble conditions */
export const REMAP_CONDITION_MAP: Record<string, { nimble: string; note: string }> = {
	deafened: { nimble: 'silenced', note: '5e deafened → Nimble silenced' },
};

/** 5e conditions with no Nimble equivalent */
export const UNMAPPED_CONDITIONS = new Set(['exhaustion']);

/**
 * Map a 5e condition name to a Nimble condition.
 * Returns null if unmapped.
 */
export function mapCondition(condition: string): { nimble: string; note?: string } | null {
	const lower = condition.toLowerCase().trim();
	if (DIRECT_CONDITION_MAP[lower]) {
		return { nimble: DIRECT_CONDITION_MAP[lower] };
	}
	if (REMAP_CONDITION_MAP[lower]) {
		return {
			nimble: REMAP_CONDITION_MAP[lower].nimble,
			note: REMAP_CONDITION_MAP[lower].note,
		};
	}
	return null;
}

// ─── 5e Activation Type → Nimble Feature Subtype ─────────────────────────────

export const DND5E_ACTIVATION_TO_SUBTYPE: Record<string, string> = {
	action: 'action',
	bonus: 'action',
	reaction: 'action',
	legendary: 'action',
	lair: 'feature',
	special: 'feature',
	none: 'feature',
	'': 'feature',
};

// ─── Text Parser Patterns ────────────────────────────────────────────────────

export const TEXT_PATTERNS = {
	ac: /^Armor Class\s+(\d+)(?:\s*\(([^)]+)\))?/i,
	hp: /^Hit Points\s+(\d+)(?:\s*\(([^)]+)\))?/i,
	speed: /^Speed\s+(.+)/i,
	abilityHeaders: /^\s*STR\s+DEX\s+CON\s+INT\s+WIS\s+CHA\s*$/i,
	abilityScores: /(\d+)\s*\(\s*([+-]?\d+)\s*\)/g,
	challenge: /^Challenge\s+(\d+(?:\/\d+)?)\s*(?:\(([\d,]+)\s*XP\))?/i,
	saves: /^Saving Throws\s+(.+)/i,
	skills: /^Skills?\s+(.+)/i,
	damageResistances: /^Damage Resistances?\s+(.+)/i,
	damageImmunities: /^Damage Immunit(?:y|ies)\s+(.+)/i,
	damageVulnerabilities: /^Damage Vulnerabilit(?:y|ies)\s+(.+)/i,
	conditionImmunities: /^Condition Immunit(?:y|ies)\s+(.+)/i,
	senses: /^Senses?\s+(.+)/i,
	languages: /^Languages?\s+(.+)/i,
	sizeTypeLine:
		/^(Tiny|Small|Medium|Large|Huge|Gargantuan)\s+(\w[\w\s]*?)(?:\s*\(([^)]+)\))?,\s*(.+)$/i,
	attackLine:
		/(?:Melee|Ranged)\s+(?:Weapon|Spell)\s+Attack:\s*\+(\d+)\s*to hit,\s*(?:reach|range)\s+(\d+)(?:\/(\d+))?\s*ft\./i,
	damagePart: /(\d+d\d+(?:\s*[+-]\s*\d+)?)\)?\s+(\w+)\s+damage/gi,
	recharge: /\(Recharge\s+(\d+)(?:[–-](\d+))?\)/i,
	usesPerDay: /\((\d+)\/Day\)/i,
	sectionHeader:
		/^(Actions|Bonus Actions|Reactions|Legendary Actions|Mythic Actions|Lair Actions|Regional Effects)$/i,
	traitName: /^([A-Z][\w\s,'-]+(?:\([^)]*\))?)\.\s*/,
	speedPart: /(?:(\w+)\s+)?(\d+)\s*ft\.?/gi,
	saveBonus: /(\w{3})\s+\+(\d+)/gi,
	skillBonus: /(\w[\w\s]+?)\s+\+(\d+)/gi,
} as const;
