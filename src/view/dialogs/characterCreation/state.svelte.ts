import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.js';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';

import getDeterministicBonus from '../../../dice/getDeterministicBonus.js';
import generateBlankAttributeSet from '../../../utils/generateBlankAttributeSet.js';
import getClassFeaturesFromIndex from '../../../utils/getClassFeatures.js';
import scrollIntoView from '../../../utils/scrollIntoView.js';
import { CHARACTER_CREATION_STAGES, DEFAULT_SKILL_POINTS } from './constants.js';
import type {
	AbilityScoreAssignment,
	CharacterCreationDialogInstance,
	GrantedLanguage,
	SchoolSelectionGroup,
	SkillPointAssignment,
	SpellGrantResult,
	SpellGrantSource,
	SpellSelectionGroup,
	StageValue,
	StatArrayOption,
} from './types.js';
import { isRaisedByBackground } from './utils/backgroundChecks.js';
import { processGrantSpellsRules } from './utils/processGrantSpellsRules.js';
import {
	getGrantSpellSelectionRuleIds,
	hasSpellGrants,
	removeConfirmedSchoolsForRuleIds,
	removeSelectionsForRuleIds,
	spellSelectionsComplete,
} from './utils/spellHelpers.js';

// --- Internal helper functions ---

function getAbilityBonuses(
	ancestry: NimbleAncestryItem | null,
	background: NimbleBackgroundItem | null,
	characterClass: NimbleClassItem | null,
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
		let targetAbilities = rule.abilities ?? [];

		if (!targetAbilities.length) return;
		if (targetAbilities.includes('all')) targetAbilities = abilityKeys;

		const bonus = getDeterministicBonus(rule.value ?? '', {});

		targetAbilities.forEach((abilityKey: string) => {
			bonuses.set(abilityKey, (bonuses.get(abilityKey) ?? 0) + Number.parseInt(String(bonus), 10));
		});
	});

	return bonuses;
}

function getSkillBonuses(
	ancestry: NimbleAncestryItem | null,
	background: NimbleBackgroundItem | null,
	characterClass: NimbleClassItem | null,
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
		let targetSkills = rule.skills ?? [];

		if (!targetSkills.length) return;
		if (targetSkills.includes('all')) targetSkills = skillKeys;

		const bonus = getDeterministicBonus(rule.value ?? '', {});

		targetSkills.forEach((skillKey: string) => {
			bonuses.set(skillKey, (bonuses.get(skillKey) ?? 0) + Number.parseInt(String(bonus), 10));
		});
	});

	return bonuses;
}

function ancestryRequiresSaveChoice(ancestry: NimbleAncestryItem | null): boolean {
	const rules = [...(ancestry?.rules?.values() ?? [])];
	if (!rules.length) return false;

	for (const rule of rules) {
		if (rule.type === 'savingThrowRollMode' && rule.requiresChoice && rule.target === 'neutral') {
			return true;
		}
	}

	return false;
}

function hasAncestryOptions(ancestry: NimbleAncestryItem | null): boolean {
	const hasSizeChoice = (ancestry?.system?.size?.length ?? 0) > 1;
	const hasSaveChoice = ancestryRequiresSaveChoice(ancestry);
	return hasSizeChoice || hasSaveChoice;
}

function ancestryOptionsComplete(
	ancestry: NimbleAncestryItem | null,
	selectedAncestrySize: string | null,
	selectedAncestrySave: string | null,
): boolean {
	const hasSizeChoice = (ancestry?.system?.size?.length ?? 0) > 1;
	const hasSaveChoice = ancestryRequiresSaveChoice(ancestry);

	if (hasSizeChoice && !selectedAncestrySize) return false;
	if (hasSaveChoice && !selectedAncestrySave) return false;

	return true;
}

function classFeaturesComplete(
	features: ClassFeatureResult | null,
	selections: Map<string, NimbleFeatureItem>,
): boolean {
	if (!features) return true;

	for (const groupName of features.selectionGroups.keys()) {
		if (!selections.has(groupName)) {
			return false;
		}
	}

	return true;
}

function hasClassFeatures(features: ClassFeatureResult | null): boolean {
	if (!features) return false;
	return features.autoGrant.length > 0 || features.selectionGroups.size > 0;
}

function getLanguageGrantsFromRules(
	rules: NimbleBaseRule[],
	intMod: number,
	source: 'ancestry' | 'background',
): GrantedLanguage[] {
	if (!rules?.length) return [];

	const grantRules = rules.filter(
		(r) => r.type === 'grantProficiency' && r.proficiencyType === 'languages',
	);

	return grantRules.flatMap((r) => {
		const intPredicate = r.predicate?.intelligence;
		if (intPredicate?.min !== undefined && intMod < intPredicate.min) {
			return [];
		}
		return (r.values ?? []).map((v) => ({ key: v.toLowerCase(), source }));
	});
}

interface GetCurrentStageParams {
	selectedClass: NimbleClassItem | null;
	selectedAncestry: NimbleAncestryItem | null;
	selectedAncestrySize: string | null;
	selectedAncestrySave: string | null;
	selectedBackground: NimbleBackgroundItem | null;
	selectedRaisedByAncestry: { language: string; label: string } | null;
	startingEquipmentChoice: 'equipment' | 'gold' | null;
	selectedArray: { array?: number[] } | null;
	selectedAbilityScores: AbilityScoreAssignment;
	remainingSkillPoints: number;
	bonusLanguages: string[];
	classFeatures: ClassFeatureResult | null;
	selectedClassFeatures: Map<string, NimbleFeatureItem>;
	spellGrants: SpellGrantResult | null;
	selectedSchools: Map<string, string[]>;
	selectedSpells: Map<string, string[]>;
	confirmedSchools: Set<string>;
	hasClasses: boolean;
	hasAncestries: boolean;
	hasBackgrounds: boolean;
}

function getCurrentStage(params: GetCurrentStageParams): StageValue {
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
		spellGrants,
		selectedSchools,
		selectedSpells,
		confirmedSchools,
		hasClasses,
		hasAncestries,
		hasBackgrounds,
	} = params;

	if (hasClasses && !selectedClass) return CHARACTER_CREATION_STAGES.CLASS;

	if (
		hasClassFeatures(classFeatures) &&
		!classFeaturesComplete(classFeatures, selectedClassFeatures)
	) {
		return CHARACTER_CREATION_STAGES.CLASS_FEATURES;
	}

	// Check class spell selections (from class features)
	if (
		hasSpellGrants(spellGrants, 'class') &&
		!spellSelectionsComplete(
			spellGrants,
			selectedSchools,
			selectedSpells,
			confirmedSchools,
			'class',
		)
	) {
		return CHARACTER_CREATION_STAGES.SPELLS;
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

	// Check background spell selections (from background rules like Academy Dropout)
	// This appears after background options so selecting a background doesn't scroll back
	if (
		hasSpellGrants(spellGrants, 'background') &&
		!spellSelectionsComplete(
			spellGrants,
			selectedSchools,
			selectedSpells,
			confirmedSchools,
			'background',
		)
	) {
		// Return SPELLS stage but scroll handling will go to the right section
		return CHARACTER_CREATION_STAGES.SPELLS;
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

function calculateRemainingSkillPoints(assignedSkillPoints: Record<string, number>): number {
	return DEFAULT_SKILL_POINTS - Object.values(assignedSkillPoints).reduce((a, b) => a + b, 0);
}

function getStageNumber(stage: StageValue): string {
	return stage.toString().match(/\d+/)?.[0] ?? '0';
}

/**
 * Parameters for creating the character creation state
 */
export interface CharacterCreationStateParams {
	ancestryOptions: Promise<Record<'core' | 'exotic', NimbleAncestryItem[]>>;
	backgroundOptions: Promise<NimbleBackgroundItem[]>;
	classFeatureIndex: Promise<ClassFeatureIndex>;
	classOptions: Promise<NimbleClassItem[]>;
	dialog: CharacterCreationDialogInstance;
	spellIndex: Promise<SpellIndex>;
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

	// Spell grants state
	let spellGrants = $state<SpellGrantResult | null>(null);
	let selectedSchools = $state<Map<string, string[]>>(new Map());
	let selectedSpells = $state<Map<string, string[]>>(new Map());
	let confirmedSchools = $state<Set<string>>(new Set());
	let resolvedSpellIndex = $state<SpellIndex | null>(null);
	let previousBackground = $state<NimbleBackgroundItem | null>(null);

	// Resolve spell index on load
	params.spellIndex
		.then((index) => {
			resolvedSpellIndex = index;
		})
		.catch((error) => {
			console.error('Failed to load spell index:', error);
		});

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
			spellGrants,
			selectedSchools,
			selectedSpells,
			confirmedSchools,
			hasClasses,
			hasAncestries,
			hasBackgrounds,
		}),
	);

	const stageNumber = $derived(getStageNumber(stage));

	const needsClassSpellSelection = $derived(
		hasSpellGrants(spellGrants, 'class') &&
			!spellSelectionsComplete(
				spellGrants,
				selectedSchools,
				selectedSpells,
				confirmedSchools,
				'class',
			),
	);

	// Determine if background spells need selection (for scroll targeting)
	const needsBackgroundSpellSelection = $derived(
		hasSpellGrants(spellGrants, 'background') &&
			!spellSelectionsComplete(
				spellGrants,
				selectedSchools,
				selectedSpells,
				confirmedSchools,
				'background',
			),
	);

	const activeSpellSelectionSource = $derived.by((): SpellGrantSource | null => {
		if (stage !== CHARACTER_CREATION_STAGES.SPELLS) return null;
		if (needsClassSpellSelection) return 'class';
		if (needsBackgroundSpellSelection) return 'background';
		return null;
	});

	// Effects
	$effect(() => {
		// Scroll to current stage when it changes
		// Special handling for SPELLS stage - scroll to the appropriate spell section
		if (activeSpellSelectionSource === 'background') {
			// If background spells need selection, scroll to background spell section
			scrollIntoView(`${params.dialog.id}-background-spells`);
		} else {
			scrollIntoView(`${params.dialog.id}-stage-${stage}`);
		}
	});

	$effect(() => {
		// Fetch class features when class changes
		const classIdentifier = selectedClass?.system?.identifier;
		if (classIdentifier) {
			params.classFeatureIndex
				.then((index) => getClassFeaturesFromIndex(index, classIdentifier, 1))
				.then((result) => {
					classFeatures = result;
					// Scroll to class features after they're loaded, if there are any
					// Use requestAnimationFrame to ensure this runs after other reactive updates
					const hasFeatures = result.autoGrant.length > 0 || result.selectionGroups.size > 0;
					if (hasFeatures) {
						requestAnimationFrame(() => {
							scrollIntoView(
								`${params.dialog.id}-stage-${CHARACTER_CREATION_STAGES.CLASS_FEATURES}`,
							);
						});
					}
				})
				.catch(console.error);
		} else {
			classFeatures = null;
		}
		// Reset class feature selections when class changes
		selectedClassFeatures = new Map();
		// Reset spell selections when class changes
		selectedSchools = new Map();
		selectedSpells = new Map();
		confirmedSchools = new Set();
		spellGrants = null;
	});

	// Process spell grants when class features or background change
	$effect(() => {
		if (!resolvedSpellIndex) {
			spellGrants = null;
			return;
		}

		// Need either class features or a background with spell grants
		const hasClassFeatureGrants = classFeatures && selectedClass;
		const hasBackgroundGrants = selectedBackground?.system?.rules?.some(
			(r) => r.type === 'grantSpells',
		);

		if (!hasClassFeatureGrants && !hasBackgroundGrants) {
			spellGrants = null;
			return;
		}

		const classIdentifier = selectedClass?.system?.identifier ?? '';
		const autoGrant: SpellIndexEntry[] = [];
		const schoolSelections: SchoolSelectionGroup[] = [];
		const spellSelections: SpellSelectionGroup[] = [];

		// Type alias for rules array
		type RulesArray = Array<{ type: string; [key: string]: unknown }>;

		// Process class feature rules
		if (classFeatures) {
			for (const feature of classFeatures.autoGrant) {
				const rules = (feature.system?.rules ?? []) as unknown as RulesArray;
				processGrantSpellsRules(
					rules,
					resolvedSpellIndex,
					classIdentifier,
					'class',
					autoGrant,
					schoolSelections,
					spellSelections,
				);
			}
		}

		// Process background rules
		if (selectedBackground?.system?.rules) {
			const backgroundRules = selectedBackground.system.rules as unknown as RulesArray;
			processGrantSpellsRules(
				backgroundRules,
				resolvedSpellIndex,
				classIdentifier,
				'background',
				autoGrant,
				schoolSelections,
				spellSelections,
			);
		}

		const hasGrants =
			autoGrant.length > 0 || schoolSelections.length > 0 || spellSelections.length > 0;

		spellGrants = {
			autoGrant,
			schoolSelections,
			spellSelections,
			hasGrants,
		};

		// Note: We no longer scroll here - scrolling is handled by the stage change effect
	});

	$effect(() => {
		// Reset ancestry save selection when ancestry changes
		void selectedAncestry;
		selectedAncestrySave = null;
	});

	$effect(() => {
		// Reset raised-by selection and spell selections when background changes
		const currentBackground = selectedBackground;
		if (previousBackground === currentBackground) return;

		const previousBackgroundRules = (previousBackground?.system?.rules ?? []) as unknown as Array<{
			type: string;
			[key: string]: unknown;
		}>;
		const backgroundSchoolRuleIds = getGrantSpellSelectionRuleIds(
			previousBackgroundRules,
			'selectSchool',
		);
		const backgroundSpellRuleIds = getGrantSpellSelectionRuleIds(
			previousBackgroundRules,
			'selectSpell',
		);

		selectedRaisedByAncestry = null;
		selectedSchools = removeSelectionsForRuleIds(selectedSchools, backgroundSchoolRuleIds);
		confirmedSchools = removeConfirmedSchoolsForRuleIds(confirmedSchools, backgroundSchoolRuleIds);
		selectedSpells = removeSelectionsForRuleIds(selectedSpells, backgroundSpellRuleIds);
		previousBackground = currentBackground;
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

		// Prepare spell data with selection options for filtering during creation
		const selectionOptions = new Map<
			string,
			{ utilityOnly: boolean; forClass: string; tiers: number[] }
		>();
		for (const group of spellGrants?.schoolSelections ?? []) {
			selectionOptions.set(group.ruleId, {
				utilityOnly: group.utilityOnly,
				forClass: group.forClass,
				tiers: group.tiers,
			});
		}

		const spellData = {
			autoGrant: spellGrants?.autoGrant?.map((s) => s.uuid) ?? [],
			selectedSchools: selectedSchools,
			selectedSpells: selectedSpells,
			selectionOptions,
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
			spells: spellData,
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
		get spellGrants() {
			return spellGrants;
		},
		get selectedSchools() {
			return selectedSchools;
		},
		set selectedSchools(value: Map<string, string[]>) {
			selectedSchools = value;
		},
		get selectedSpells() {
			return selectedSpells;
		},
		set selectedSpells(value: Map<string, string[]>) {
			selectedSpells = value;
		},
		get confirmedSchools() {
			return confirmedSchools;
		},
		set confirmedSchools(value: Set<string>) {
			confirmedSchools = value;
		},
		get spellIndex() {
			return resolvedSpellIndex;
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
		get activeSpellSelectionSource() {
			return activeSpellSelectionSource;
		},

		// Actions
		handleCreateCharacter,
	};
}

export type CharacterCreationState = ReturnType<typeof createCharacterCreationState>;
