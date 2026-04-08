import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';
import type { ExpandableDocumentItem } from '#types/components/ExpandableDocumentList.d.ts';

import generateBlankSkillSet from '#utils/generateBlankSkillSet.ts';
import getChoicesFromCompendium from '#utils/getChoicesFromCompendium.ts';
import getClassFeaturesFromIndex, { buildClassFeatureIndex } from '#utils/getClassFeatures.ts';
import getEpicBoons from '#utils/getEpicBoons.ts';
import getSubclassChoices from '#utils/getSubclassChoices.ts';

import { EPIC_BOON_LEVEL, SUBCLASS_LEVEL } from './const/levelUpConstants.ts';

/** Structural type for what the factory accesses on a class item */
interface ClassItemShape {
	system?: { classLevel?: number };
	identifier: string;
}

/** Structural type for what the factory accesses on the actor document */
interface LevelUpDocument {
	classes: Record<string, ClassItemShape | undefined>;
	items: Array<{ type: string; _stats?: { compendiumSource?: string } }>;
}

interface SubclassChoice {
	uuid: string;
	name: string;
	img: string;
	system: { parentClass: string };
}

interface EpicBoonChoice {
	uuid: string;
	name: string;
	img: string;
	system: { boonType: string; description: string };
}

/**
 * Creates reactive state for the CharacterLevelUpDialog component.
 *
 * Manages all level-up form state including ability scores, skill points,
 * subclass/boon selection, class features, and form completion validation.
 */
export function createLevelUpState(
	getDocument: () => LevelUpDocument,
	getDialog: () => { submit(data: Record<string, unknown>): void },
) {
	const { forms, levelUpDialog } = CONFIG.NIMBLE;

	const boons = getChoicesFromCompendium('boon');

	// Derived character info
	const characterClass = $derived(
		getDocument()?.classes
			? (Object.values(getDocument().classes)[0] as ClassItemShape | undefined)
			: undefined,
	);
	const level = $derived(characterClass?.system?.classLevel ?? 1);
	const levelingTo = $derived(level + 1);

	// Subclass state (level 3)
	let subclasses: SubclassChoice[] = $state([]);
	const hasSubclassSelection = $derived(levelingTo === SUBCLASS_LEVEL);

	// Epic boon state (level 19)
	let epicBoons: EpicBoonChoice[] = $state([]);
	const hasEpicBoonSelection = $derived(levelingTo === EPIC_BOON_LEVEL);

	// Load subclasses filtered by parent class when leveling to 3
	$effect(() => {
		if (hasSubclassSelection && characterClass) {
			getSubclassChoices(characterClass.identifier).then((choices) => {
				subclasses = choices;
			});
		}
	});

	// Load epic boons when leveling to 19
	$effect(() => {
		if (hasEpicBoonSelection) {
			getEpicBoons().then((choices) => {
				epicBoons = choices;
			});
		}
	});

	// Form state
	let chooseBoon = $state(false);
	let hitPointRollSelection = $state('roll');
	let selectedAbilityScores: string[] | string | null = $state(null);
	let lastSelectedAbilityScores: string[] | string | null = $state(null);
	let selectedBoon: string | null = $state(null);
	let selectedSubclass: ExpandableDocumentItem | null = $state(null);
	let selectedEpicBoon: ExpandableDocumentItem | null = $state(null);
	let skillPointChanges = $state(generateBlankSkillSet());
	let hasStatIncrease = $state(false);
	let skillPointsOverMax = $state(false);

	// Class features state
	let classFeatures: ClassFeatureResult | null = $state(null);
	let selectedClassFeatures: Map<string, NimbleFeatureItem> = $state(new Map());
	let featuresLoading = $state(true);

	// Load class features when dialog opens
	$effect(() => {
		if (!characterClass) return;

		featuresLoading = true;
		buildClassFeatureIndex().then(async (index) => {
			const rawFeatures = await getClassFeaturesFromIndex(
				index,
				characterClass.identifier,
				levelingTo,
			);

			// Get UUIDs of features the character already has (via compendiumSource)
			const ownedFeatureUuids = new Set(
				(getDocument().items ?? [])
					.filter((item) => item.type === 'feature')
					.map(
						(item) =>
							(item as unknown as { _stats?: { compendiumSource?: string } })._stats
								?.compendiumSource,
					)
					.filter((uuid): uuid is string => !!uuid),
			);

			// Filter out already-owned features from autoGrant
			const filteredAutoGrant = rawFeatures.autoGrant.filter(
				(feature) => !ownedFeatureUuids.has(feature.uuid),
			);

			// Filter out already-owned features from selection groups
			const filteredSelectionGroups = new Map<string, NimbleFeatureItem[]>();
			for (const [groupName, features] of rawFeatures.selectionGroups) {
				const filteredFeatures = features.filter((feature) => !ownedFeatureUuids.has(feature.uuid));
				// Only include groups that still have options
				if (filteredFeatures.length > 0) {
					filteredSelectionGroups.set(groupName, filteredFeatures);
				}
			}

			classFeatures = {
				autoGrant: filteredAutoGrant,
				selectionGroups: filteredSelectionGroups,
			};
			featuresLoading = false;
		});
	});

	// Derived completion checks
	const classFeaturesComplete = $derived.by(() => {
		if (featuresLoading) return false;
		if (!classFeatures) return true;

		for (const groupName of classFeatures.selectionGroups.keys()) {
			if (!selectedClassFeatures.has(groupName)) {
				return false;
			}
		}
		return true;
	});

	const skillPointChangesAssigned = $derived.by(() => {
		return Object.values(skillPointChanges).reduce((acc, change) => acc + (change ?? 0), 0) === 1;
	});

	// Reset skills when ability score selection changes
	$effect(() => {
		if (!lastSelectedAbilityScores) {
			lastSelectedAbilityScores = selectedAbilityScores;
			return;
		}

		const hasChangedAbilityScore = Array.isArray(selectedAbilityScores)
			? JSON.stringify(lastSelectedAbilityScores) !== JSON.stringify(selectedAbilityScores)
			: lastSelectedAbilityScores !== selectedAbilityScores;

		if (hasChangedAbilityScore) {
			skillPointChanges = generateBlankSkillSet();
			lastSelectedAbilityScores = selectedAbilityScores;
		}
	});

	const isComplete = $derived.by(() => {
		const overMax = skillPointsOverMax;

		const abilityScoreComplete =
			(Array.isArray(selectedAbilityScores)
				? selectedAbilityScores?.length === 2
				: selectedAbilityScores) || !hasStatIncrease;

		return (
			abilityScoreComplete &&
			skillPointChangesAssigned &&
			!overMax &&
			(selectedSubclass || !hasSubclassSelection) &&
			(selectedEpicBoon || !hasEpicBoonSelection) &&
			classFeaturesComplete
		);
	});

	// Actions
	function submit() {
		getDialog().submit({
			selectedAbilityScore: selectedAbilityScores,
			selectedSubclass,
			selectedEpicBoon,
			skillPointChanges,
			takeAverageHp: hitPointRollSelection === 'average',
			classFeatures: classFeatures
				? {
						autoGrant: classFeatures.autoGrant,
						selected: selectedClassFeatures,
					}
				: null,
		});
	}

	function getSubmitButtonTooltip() {
		if (!isComplete) {
			if (skillPointsOverMax) {
				return levelUpDialog.skillPointsOverMax;
			} else {
				return levelUpDialog.completeAllSelections;
			}
		}

		return '';
	}

	function getSubmitButtonAriaLabel() {
		if (!isComplete) {
			if (skillPointsOverMax) {
				return levelUpDialog.skillPointsOverMaxTooltip;
			} else {
				return levelUpDialog.completeAllSelectionsTooltip;
			}
		}

		return forms.submit;
	}

	return {
		boons,
		get characterClass() {
			return characterClass;
		},
		get levelingTo() {
			return levelingTo;
		},
		get subclasses() {
			return subclasses;
		},
		get hasSubclassSelection() {
			return hasSubclassSelection;
		},
		get epicBoons() {
			return epicBoons;
		},
		get hasEpicBoonSelection() {
			return hasEpicBoonSelection;
		},
		get classFeatures() {
			return classFeatures;
		},
		get featuresLoading() {
			return featuresLoading;
		},
		get isComplete() {
			return isComplete;
		},
		get chooseBoon() {
			return chooseBoon;
		},
		set chooseBoon(v: boolean) {
			chooseBoon = v;
		},
		get hitPointRollSelection() {
			return hitPointRollSelection;
		},
		set hitPointRollSelection(v: string) {
			hitPointRollSelection = v;
		},
		get selectedAbilityScores() {
			return selectedAbilityScores;
		},
		set selectedAbilityScores(v: string[] | string | null) {
			selectedAbilityScores = v;
		},
		get selectedBoon() {
			return selectedBoon;
		},
		set selectedBoon(v: string | null) {
			selectedBoon = v;
		},
		get selectedSubclass() {
			return selectedSubclass;
		},
		set selectedSubclass(v: ExpandableDocumentItem | null) {
			selectedSubclass = v;
		},
		get selectedEpicBoon() {
			return selectedEpicBoon;
		},
		set selectedEpicBoon(v: ExpandableDocumentItem | null) {
			selectedEpicBoon = v;
		},
		get skillPointChanges() {
			return skillPointChanges;
		},
		set skillPointChanges(v: Record<string, null>) {
			skillPointChanges = v;
		},
		get hasStatIncrease() {
			return hasStatIncrease;
		},
		set hasStatIncrease(v: boolean) {
			hasStatIncrease = v;
		},
		get skillPointsOverMax() {
			return skillPointsOverMax;
		},
		set skillPointsOverMax(v: boolean) {
			skillPointsOverMax = v;
		},
		get selectedClassFeatures() {
			return selectedClassFeatures;
		},
		set selectedClassFeatures(v: Map<string, NimbleFeatureItem>) {
			selectedClassFeatures = v;
		},
		submit,
		getSubmitButtonTooltip,
		getSubmitButtonAriaLabel,
	};
}
