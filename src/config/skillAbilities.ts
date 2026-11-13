import type { AbilityKeyType } from '#types/abilityKey.js';
import type { SkillKeyType } from '#types/skillKey.js';

/** Each skill of the system, with the ability it uses by default. */
export const defaultSkillAbilities: Record<SkillKeyType, AbilityKeyType> = {
	arcana: 'intelligence',
	examination: 'intelligence',
	finesse: 'dexterity',
	influence: 'will',
	insight: 'will',
	might: 'strength',
	lore: 'intelligence',
	naturecraft: 'will',
	perception: 'will',
	stealth: 'dexterity',
};

/** The skill keys, in alphabetical order. */
export const SKILL_KEYS = (Object.keys(defaultSkillAbilities) as SkillKeyType[]).sort();
