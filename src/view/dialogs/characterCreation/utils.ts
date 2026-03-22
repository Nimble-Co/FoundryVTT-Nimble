import getDeterministicBonus from '../../../dice/getDeterministicBonus.js';
import { CHARACTER_CREATION_STAGES, DEFAULT_SKILL_POINTS } from './constants.js';
import type {
	AbilityScoreAssignment,
	ClassFeatureResult,
	GrantedLanguage,
	NimbleFeatureItem,
	StageValue,
} from './types.js';

// Type alias for origin items with rules - these are dynamic Foundry types
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OriginItem = any;

/**
 * Calculates ability score bonuses from ancestry, background, and class rules
 */
export function getAbilityBonuses(
	ancestry: OriginItem,
	background: OriginItem,
	characterClass: OriginItem,
): Map<string, number> | null {
	const abilityKeys = Object.keys(CONFIG.NIMBLE.abilityScores);

	const rules = [
		...(ancestry?.rules?.values() ?? []),
		...(background?.rules?.values() ?? []),
		...(characterClass?.rules?.values() ?? []),
	];

	if (!rules.length) return null;

	const statBonusRules = rules.filter((rule) => rule.type === 'abilityBonus');

	if (!statBonusRules.length) return null;

	const bonuses = new Map(abilityKeys.map((key) => [key, 0]));

	statBonusRules.forEach((rule) => {
		let targetAbilities = rule.abilities;

		if (!targetAbilities.length) return;
		if (targetAbilities.includes('all')) targetAbilities = abilityKeys;

		const bonus = getDeterministicBonus(rule.value, {});

		targetAbilities.forEach((abilityKey: string) => {
			bonuses.set(abilityKey, (bonuses.get(abilityKey) ?? 0) + Number.parseInt(String(bonus), 10));
		});
	});

	return bonuses;
}

/**
 * Calculates skill bonuses from ancestry, background, and class rules
 */
export function getSkillBonuses(
	ancestry: OriginItem,
	background: OriginItem,
	characterClass: OriginItem,
): Map<string, number> | null {
	const skillKeys = Object.keys(CONFIG.NIMBLE.skills);

	const rules = [
		...(ancestry?.rules?.values() ?? []),
		...(background?.rules?.values() ?? []),
		...(characterClass?.rules?.values() ?? []),
	];

	const skillBonusRules = rules.filter((rule) => rule.type === 'skillBonus');

	if (!rules.length) return null;

	const bonuses = new Map(skillKeys.map((key) => [key, 0]));

	skillBonusRules.forEach((rule) => {
		let targetSkills = rule.skills;

		if (!targetSkills.length) return;
		if (targetSkills.includes('all')) targetSkills = skillKeys;

		const bonus = getDeterministicBonus(rule.value, {});

		targetSkills.forEach((skillKey: string) => {
			bonuses.set(skillKey, (bonuses.get(skillKey) ?? 0) + Number.parseInt(String(bonus), 10));
		});
	});

	return bonuses;
}

/**
 * Checks if an ancestry has a saving throw choice rule
 */
export function ancestryRequiresSaveChoice(ancestry: OriginItem): boolean {
	const rules = [...(ancestry?.rules?.values() ?? [])];
	if (!rules.length) return false;

	for (const rule of rules) {
		if (rule.type === 'savingThrowRollMode' && rule.requiresChoice && rule.target === 'neutral') {
			return true;
		}
	}

	return false;
}

/**
 * Checks if an ancestry has any options that need to be selected
 */
export function hasAncestryOptions(ancestry: OriginItem): boolean {
	const hasSizeChoice = (ancestry?.system?.size?.length ?? 0) > 1;
	const hasSaveChoice = ancestryRequiresSaveChoice(ancestry);
	return hasSizeChoice || hasSaveChoice;
}

/**
 * Checks if all ancestry options have been selected
 */
export function ancestryOptionsComplete(
	ancestry: OriginItem,
	selectedAncestrySize: string | null,
	selectedAncestrySave: string | null,
): boolean {
	const hasSizeChoice = (ancestry?.system?.size?.length ?? 0) > 1;
	const hasSaveChoice = ancestryRequiresSaveChoice(ancestry);

	if (hasSizeChoice && !selectedAncestrySize) return false;
	if (hasSaveChoice && !selectedAncestrySave) return false;

	return true;
}

/**
 * Checks if a background is a "Raised by" type that allows ancestry selection
 */
export function isRaisedByBackground(background: OriginItem): boolean {
	return background?.name?.toLowerCase().includes('raised by') ?? false;
}

/**
 * Checks if all required class feature selections have been made
 */
export function classFeaturesComplete(
	features: ClassFeatureResult | null,
	selections: Map<string, NimbleFeatureItem>,
): boolean {
	if (!features) return true; // No features to select

	// If there are selection groups, all must have a selection
	for (const groupName of features.selectionGroups.keys()) {
		if (!selections.has(groupName)) {
			return false;
		}
	}

	return true;
}

/**
 * Checks if a class has any features at level 1
 */
export function hasClassFeatures(features: ClassFeatureResult | null): boolean {
	if (!features) return false;
	return features.autoGrant.length > 0 || features.selectionGroups.size > 0;
}

/**
 * Extracts language grants from rules, checking INT predicate
 */
export function getLanguageGrantsFromRules(
	rules: Array<{
		type: string;
		proficiencyType?: string;
		predicate?: { intelligence?: { min?: number } };
		values?: string[];
	}>,
	intMod: number,
	source: 'ancestry' | 'background',
): GrantedLanguage[] {
	if (!rules?.length) return [];

	const grantRules = rules.filter(
		(r) => r.type === 'grantProficiency' && r.proficiencyType === 'languages',
	);

	return grantRules.flatMap((r) => {
		// Check predicate for INT requirement
		const intPredicate = r.predicate?.intelligence;
		if (intPredicate?.min !== undefined && intMod < intPredicate.min) {
			return [];
		}
		return (r.values ?? []).map((v) => ({ key: v.toLowerCase(), source }));
	});
}

/**
 * Parameters for determining the current stage
 */
export interface GetCurrentStageParams {
	selectedClass: OriginItem;
	selectedAncestry: OriginItem;
	selectedAncestrySize: string | null;
	selectedAncestrySave: string | null;
	selectedBackground: OriginItem;
	selectedRaisedByAncestry: { language: string; label: string } | null;
	startingEquipmentChoice: 'equipment' | 'gold' | null;
	selectedArray: { array?: number[] } | null;
	selectedAbilityScores: AbilityScoreAssignment;
	remainingSkillPoints: number;
	bonusLanguages: string[];
	classFeatures: ClassFeatureResult | null;
	selectedClassFeatures: Map<string, NimbleFeatureItem>;
	hasClasses: boolean;
	hasAncestries: boolean;
	hasBackgrounds: boolean;
}

/**
 * Determines the current stage of character creation based on completed selections
 */
export function getCurrentStage(params: GetCurrentStageParams): StageValue {
	const {
		selectedClass,
		selectedAncestry,
		selectedAncestrySize,
		selectedAncestrySave,
		selectedBackground,
		selectedRaisedByAncestry,
		startingEquipmentChoice,
		selectedArray,
		selectedAbilityScores,
		remainingSkillPoints,
		bonusLanguages,
		classFeatures,
		selectedClassFeatures,
		hasClasses,
		hasAncestries,
		hasBackgrounds,
	} = params;

	if (hasClasses && !selectedClass) return CHARACTER_CREATION_STAGES.CLASS;

	// Check class features stage (only if class has features at level 1)
	if (
		hasClassFeatures(classFeatures) &&
		!classFeaturesComplete(classFeatures, selectedClassFeatures)
	) {
		return CHARACTER_CREATION_STAGES.CLASS_FEATURES;
	}

	if (hasAncestries && !selectedAncestry) {
		return CHARACTER_CREATION_STAGES.ANCESTRY;
	}

	if (
		hasAncestryOptions(selectedAncestry) &&
		!ancestryOptionsComplete(selectedAncestry, selectedAncestrySize, selectedAncestrySave)
	) {
		return CHARACTER_CREATION_STAGES.ANCESTRY_OPTIONS;
	}

	if (hasBackgrounds && !selectedBackground) {
		return CHARACTER_CREATION_STAGES.BACKGROUND;
	}

	if (isRaisedByBackground(selectedBackground) && selectedRaisedByAncestry === null) {
		return CHARACTER_CREATION_STAGES.BACKGROUND_OPTIONS;
	}

	if (!startingEquipmentChoice) return CHARACTER_CREATION_STAGES.STARTING_EQUIPMENT;

	if (!selectedArray) return CHARACTER_CREATION_STAGES.ARRAY;

	const hasUnassignedAbilityScores = Object.values(selectedAbilityScores).some(
		(mod) => mod === null,
	);

	if (hasUnassignedAbilityScores) return CHARACTER_CREATION_STAGES.STATS;
	if (remainingSkillPoints) return CHARACTER_CREATION_STAGES.SKILLS;

	const intelligenceModifier = selectedArray.array?.[selectedAbilityScores.intelligence ?? 0] ?? 0;

	if (
		!remainingSkillPoints &&
		intelligenceModifier > 0 &&
		bonusLanguages.length < intelligenceModifier
	) {
		return CHARACTER_CREATION_STAGES.LANGUAGES;
	}

	return CHARACTER_CREATION_STAGES.SUBMIT;
}

/**
 * Calculates remaining skill points based on assigned points
 */
export function calculateRemainingSkillPoints(assignedSkillPoints: Record<string, number>): number {
	return DEFAULT_SKILL_POINTS - Object.values(assignedSkillPoints).reduce((a, b) => a + b, 0);
}

/**
 * Extracts the numeric portion from a stage value for progress bar display
 */
export function getStageNumber(stage: StageValue): string {
	return stage.toString().match(/\d+/)?.[0] ?? '0';
}
