import generateBlankAttributeSet from '../../../utils/generateBlankAttributeSet.js';
import getClassFeatures from '../../../utils/getClassFeatures.js';
import scrollIntoView from '../../../utils/scrollIntoView.js';
import { CHARACTER_CREATION_STAGES } from './constants.js';
import type {
	AbilityScoreAssignment,
	CharacterCreationDialogInstance,
	ClassFeatureResult,
	GrantedLanguage,
	NimbleFeatureItem,
	SkillPointAssignment,
	StatArrayOption,
} from './types.js';
import {
	calculateRemainingSkillPoints,
	getAbilityBonuses,
	getCurrentStage,
	getLanguageGrantsFromRules,
	getSkillBonuses,
	getStageNumber,
	isRaisedByBackground,
} from './utils.js';

/**
 * Parameters for creating the character creation state
 */
export interface CharacterCreationStateParams {
	ancestryOptions: Promise<Record<'core' | 'exotic', NimbleAncestryItem[]>>;
	backgroundOptions: Promise<NimbleBackgroundItem[]>;
	classOptions: Promise<NimbleClassItem[]>;
	dialog: CharacterCreationDialogInstance;
}

/**
 * Creates reactive state for the character creation dialog
 *
 * This factory function encapsulates all reactive state management for character creation,
 * including selections, derived values, and side effects.
 */
export function createCharacterCreationState(params: CharacterCreationStateParams) {
	// Core selections
	let name = $state('');
	let selectedClass = $state<NimbleClassItem | null>(null);
	let selectedAncestry = $state<NimbleAncestryItem | null>(null);
	let selectedAncestrySize = $state<string>('medium');
	let selectedAncestrySave = $state<string | null>(null);
	let selectedBackground = $state<NimbleBackgroundItem | null>(null);
	let selectedRaisedByAncestry = $state<{ language: string; label: string } | null>(null);
	let startingEquipmentChoice = $state<'equipment' | 'gold' | null>(null);
	let selectedArray = $state<StatArrayOption | null>(null);
	let selectedAbilityScores = $state<AbilityScoreAssignment>(generateBlankAttributeSet());
	let assignedSkillPoints = $state<SkillPointAssignment>({});
	let bonusLanguages = $state<string[]>([]);

	// Class features state
	let classFeatures = $state<ClassFeatureResult | null>(null);
	let selectedClassFeatures = $state<Map<string, NimbleFeatureItem>>(new Map());

	// Derived values
	const abilityBonuses = $derived(
		getAbilityBonuses(selectedAncestry, selectedBackground, selectedClass),
	);

	const skillBonuses = $derived(
		getSkillBonuses(selectedAncestry, selectedBackground, selectedClass),
	);

	const remainingSkillPoints = $derived(calculateRemainingSkillPoints(assignedSkillPoints));

	// Track whether stats have been fully assigned (to avoid running effects during drag)
	const statsFullyAssigned = $derived(
		Object.values(selectedAbilityScores).every((mod) => mod !== null),
	);

	// Languages granted by ancestry (based on rules with INT predicate)
	const ancestryGrantedLanguages = $derived.by((): GrantedLanguage[] => {
		if (!selectedAncestry || !selectedArray || selectedAbilityScores.intelligence === null)
			return [];
		const intMod = selectedArray.array?.[selectedAbilityScores.intelligence] ?? 0;

		const rules = [...(selectedAncestry?.system?.rules ?? [])];
		return getLanguageGrantsFromRules(rules, intMod, 'ancestry');
	});

	// Languages granted by background
	const backgroundGrantedLanguages = $derived.by((): GrantedLanguage[] => {
		if (!selectedBackground) return [];

		// For "Raised by" backgrounds, use the language stored with the selected ancestry
		if (isRaisedByBackground(selectedBackground)) {
			if (!selectedRaisedByAncestry?.language) return [];
			return [{ key: selectedRaisedByAncestry.language, source: 'background' }];
		}

		// For other backgrounds with grantProficiency rules
		const rules = [...(selectedBackground?.system?.rules ?? [])];
		const grantRules = rules.filter(
			(r) => r.type === 'grantProficiency' && r.proficiencyType === 'languages',
		);
		return grantRules.flatMap((r) =>
			(r.values ?? []).map((v) => ({
				key: v.toLowerCase(),
				source: 'background' as const,
			})),
		);
	});

	// Combined granted languages (deduplicated by key)
	const grantedLanguages = $derived.by((): GrantedLanguage[] => {
		const all = [...ancestryGrantedLanguages, ...backgroundGrantedLanguages];
		const seen = new Set<string>();
		return all.filter((lang) => {
			if (seen.has(lang.key)) return false;
			seen.add(lang.key);
			return true;
		});
	});

	// Current stage determination - this needs to be async-aware
	// We'll track option counts separately
	let hasClasses = $state(true);
	let hasAncestries = $state(true);
	let hasBackgrounds = $state(true);

	// Initialize option counts asynchronously
	params.classOptions.then((classes) => {
		hasClasses = classes.length > 0;
	});
	params.ancestryOptions.then((ancestries) => {
		hasAncestries =
			Object.values(ancestries).reduce((count, category) => count + category.length, 0) > 0;
	});
	params.backgroundOptions.then((backgrounds) => {
		hasBackgrounds = backgrounds.length > 0;
	});

	const stage = $derived(
		getCurrentStage({
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
		}),
	);

	const stageNumber = $derived(getStageNumber(stage));

	// Effects
	$effect(() => {
		// Scroll to current stage when it changes
		scrollIntoView(`${params.dialog.id}-stage-${stage}`);
	});

	$effect(() => {
		// Fetch class features when class changes
		const classIdentifier = selectedClass?.system?.identifier;
		if (classIdentifier) {
			getClassFeatures(classIdentifier, 1).then((result) => {
				classFeatures = result;
				// Scroll to class features after they're loaded, if there are any
				// Use requestAnimationFrame to ensure this runs after other reactive updates
				const hasFeatures = result.autoGrant.length > 0 || result.selectionGroups.size > 0;
				if (hasFeatures) {
					requestAnimationFrame(() => {
						scrollIntoView(`${params.dialog.id}-stage-${CHARACTER_CREATION_STAGES.CLASS_FEATURES}`);
					});
				}
			});
		} else {
			classFeatures = null;
		}
		// Reset class feature selections when class changes
		selectedClassFeatures = new Map();
	});

	$effect(() => {
		// Reset ancestry save selection when ancestry changes
		void selectedAncestry;
		selectedAncestrySave = null;
	});

	$effect(() => {
		// Reset raised-by selection when background changes
		void selectedBackground;
		selectedRaisedByAncestry = null;
	});

	$effect(() => {
		// Only run after stats are fully assigned (not during drag operations)
		if (!statsFullyAssigned) return;

		const intMod = selectedArray?.array?.[selectedAbilityScores.intelligence ?? 0] ?? 0;

		// Only reset if there are actually languages to clear
		if (bonusLanguages.length > 0 && intMod < bonusLanguages.length) {
			bonusLanguages = [];
		}
	});

	// Actions
	async function handleCreateCharacter() {
		if (stage === CHARACTER_CREATION_STAGES.SUBMIT) {
			submit();
			return;
		}

		const { characterCreation } = CONFIG.NIMBLE;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: {
				title: characterCreation.incompleteCharacterTitle,
			},
			content: `<p>${characterCreation.incompleteCharacterMessage}</p>`,
			yes: {
				label: characterCreation.incompleteCharacterProceed,
			},
			no: {
				label: characterCreation.incompleteCharacterReturn,
			},
			rejectClose: false,
			modal: true,
		});

		if (confirmed) {
			submit();
		}
	}

	function submit() {
		// Prepare class features data
		const classFeatureData = {
			autoGrant: classFeatures?.autoGrant?.map((f) => f.uuid) ?? [],
			selected: selectedClassFeatures,
		};

		params.dialog.submitCharacterCreation({
			name,
			origins: {
				background: selectedBackground ?? undefined,
				characterClass: selectedClass ?? undefined,
				ancestry: selectedAncestry ?? undefined,
			},
			startingEquipmentChoice: startingEquipmentChoice ?? undefined,
			abilityScores: Object.entries(selectedAbilityScores).reduce(
				(assignedScores, [abilityKey, index]) => {
					assignedScores[`${abilityKey}.baseValue`] = selectedArray?.array?.[index ?? 0] ?? 0;
					return assignedScores;
				},
				{} as Record<string, number>,
			),
			sizeCategory: selectedAncestrySize,
			selectedAncestrySave,
			selectedRaisedByAncestry,
			skills: Object.entries(assignedSkillPoints).reduce(
				(assignedPoints, [skillKey, points]) => {
					assignedPoints[`${skillKey}.points`] = points;
					return assignedPoints;
				},
				{} as Record<string, number>,
			),
			// Only include common + bonus languages; rule-granted languages are handled by the rules at runtime
			languages: ['common', ...bonusLanguages],
			classFeatures: classFeatureData,
		});
	}

	return {
		// Getters for state values
		get name() {
			return name;
		},
		set name(value: string) {
			name = value;
		},
		get selectedClass() {
			return selectedClass;
		},
		set selectedClass(value: NimbleClassItem | null) {
			selectedClass = value;
		},
		get selectedAncestry() {
			return selectedAncestry;
		},
		set selectedAncestry(value: NimbleAncestryItem | null) {
			selectedAncestry = value;
		},
		get selectedAncestrySize() {
			return selectedAncestrySize;
		},
		set selectedAncestrySize(value: string) {
			selectedAncestrySize = value;
		},
		get selectedAncestrySave() {
			return selectedAncestrySave;
		},
		set selectedAncestrySave(value: string | null) {
			selectedAncestrySave = value;
		},
		get selectedBackground() {
			return selectedBackground;
		},
		set selectedBackground(value: NimbleBackgroundItem | null) {
			selectedBackground = value;
		},
		get selectedRaisedByAncestry() {
			return selectedRaisedByAncestry;
		},
		set selectedRaisedByAncestry(value: { language: string; label: string } | null) {
			selectedRaisedByAncestry = value;
		},
		get startingEquipmentChoice() {
			return startingEquipmentChoice;
		},
		set startingEquipmentChoice(value: 'equipment' | 'gold' | null) {
			startingEquipmentChoice = value;
		},
		get selectedArray() {
			return selectedArray;
		},
		set selectedArray(value: StatArrayOption | null) {
			selectedArray = value;
		},
		get selectedAbilityScores() {
			return selectedAbilityScores;
		},
		set selectedAbilityScores(value: AbilityScoreAssignment) {
			selectedAbilityScores = value;
		},
		get assignedSkillPoints() {
			return assignedSkillPoints;
		},
		set assignedSkillPoints(value: SkillPointAssignment) {
			assignedSkillPoints = value;
		},
		get bonusLanguages() {
			return bonusLanguages;
		},
		set bonusLanguages(value: string[]) {
			bonusLanguages = value;
		},
		get classFeatures() {
			return classFeatures;
		},
		get selectedClassFeatures() {
			return selectedClassFeatures;
		},
		set selectedClassFeatures(value: Map<string, NimbleFeatureItem>) {
			selectedClassFeatures = value;
		},

		// Derived values
		get abilityBonuses() {
			return abilityBonuses;
		},
		get skillBonuses() {
			return skillBonuses;
		},
		get remainingSkillPoints() {
			return remainingSkillPoints;
		},
		get grantedLanguages() {
			return grantedLanguages;
		},
		get stage() {
			return stage;
		},
		get stageNumber() {
			return stageNumber;
		},

		// Actions
		handleCreateCharacter,
	};
}

export type CharacterCreationState = ReturnType<typeof createCharacterCreationState>;
