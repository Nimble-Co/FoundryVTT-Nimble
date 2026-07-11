import type {
	AbilityScoreAssignment,
	GrantedLanguage,
	StatArrayOption,
} from '../../characterCreation/types.js';

// `TagGroupOption` is a global ambient type (types/tagGroupOption.d.ts).

/** Props for the bonus-language character-creation step. */
export interface BonusLanguageSelectionProps {
	active: boolean;
	/** Identifier of the selected ancestry, used to resolve ancestry-specific names. */
	ancestryIdentifier?: string | null;
	/** Player-chosen bonus languages (two-way bound). */
	bonusLanguages: string[];
	/** Selectable bonus-language options. */
	bonusLanguageOptions: TagGroupOption[];
	/** Languages already granted by ancestry/background. */
	grantedLanguages?: GrantedLanguage[];
	remainingSkillPoints: number;
	selectedAbilityScores: AbilityScoreAssignment;
	selectedArray: StatArrayOption | null;
}
