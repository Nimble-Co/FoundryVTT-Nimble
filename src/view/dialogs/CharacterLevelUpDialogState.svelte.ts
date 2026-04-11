import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';
import type { ExpandableDocumentItem } from '#types/components/ExpandableDocumentList.d.ts';
import type { EpicBoonChoice, SubclassChoice } from '#types/components/LevelUpChoices.d.ts';
import generateBlankSkillSet from '#utils/generateBlankSkillSet.ts';
import getChoicesFromCompendium from '#utils/getChoicesFromCompendium.ts';
import getClassFeaturesFromIndex, { buildClassFeatureIndex } from '#utils/getClassFeatures.ts';
import getEpicBoons from '#utils/getEpicBoons.ts';
import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';
import { buildSpellIndex } from '#utils/getSpells.ts';
import { getSpellsFromIndex } from '#utils/getSpellsFromIndex.ts';
import getSubclassChoices from '#utils/getSubclassChoices.ts';

import type { SchoolSelectionGroup } from './characterCreation/types.js';
import { EPIC_BOON_LEVEL, SUBCLASS_LEVEL } from './const/levelUpConstants.ts';
import { collectSpellGrants, type RulesArray } from './spellGrantUtils.ts';

/** Structural type for what the factory accesses on a class item */
interface ClassItemShape {
	system?: { classLevel?: number };
	identifier: string;
}

/** Structural type for what the factory accesses on the actor document */
interface LevelUpDocument {
	classes: Record<string, ClassItemShape | undefined>;
	items: Array<{
		type: string;
		system?: {
			rules?: Array<{ type: string; [key: string]: unknown }>;
			school?: string;
		};
		_stats?: { compendiumSource?: string };
	}>;
}

/**
 * Creates reactive state for the CharacterLevelUpDialog component.
 *
 * Manages all level-up form state including ability scores, skill points,
 * subclass/boon selection, class features, spell grants, and form completion validation.
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
			getSubclassChoices(characterClass.identifier)
				.then((choices) => {
					subclasses = choices;
				})
				.catch((err) => {
					console.warn('Nimble | Failed to load subclass choices:', err);
				});
		}
	});

	// Load epic boons when leveling to 19
	$effect(() => {
		if (hasEpicBoonSelection) {
			getEpicBoons()
				.then((choices) => {
					epicBoons = choices;
				})
				.catch((err) => {
					console.warn('Nimble | Failed to load epic boons:', err);
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

	// Spell grants state
	let resolvedSpellIndex = $state<SpellIndex | null>(null);
	let autoGrantedSpells = $state<SpellIndexEntry[]>([]);
	let schoolSelections = $state<SchoolSelectionGroup[]>([]);
	let selectedSchools = $state<Map<string, string[]>>(new Map());
	let confirmedSchools = $state<Set<string>>(new Set());

	// Load spell index
	buildSpellIndex()
		.then((index) => {
			resolvedSpellIndex = index;
		})
		.catch((err) => {
			console.warn('Nimble | Failed to load spell index:', err);
		});

	// Load class features when dialog opens
	$effect(() => {
		if (!characterClass) {
			featuresLoading = false;
			return;
		}

		featuresLoading = true;
		buildClassFeatureIndex()
			.then(async (index) => {
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
					const filteredFeatures = features.filter(
						(feature) => !ownedFeatureUuids.has(feature.uuid),
					);
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
			})
			.catch((err) => {
				console.warn('Nimble | Failed to load class features:', err);
				featuresLoading = false;
			});
	});

	// Process spell grants when class features and spell index are ready
	$effect(() => {
		if (!resolvedSpellIndex || featuresLoading) {
			autoGrantedSpells = [];
			schoolSelections = [];
			return;
		}

		const classIdentifier = characterClass?.identifier ?? '';
		const items = getDocument().items ?? [];

		// Get already-owned spell UUIDs
		const ownedSpellUuids = new Set<string>();
		for (const item of items) {
			if (item.type !== 'spell') continue;
			const source = (item as unknown as { _stats?: { compendiumSource?: string } })._stats
				?.compendiumSource;
			if (source) ownedSpellUuids.add(source);
		}

		// Derive known schools from auto-mode grantSpells rules on class features,
		// NOT from owned spells. A background-granted spell doesn't make a school "known".
		const knownSchools = new Set<string>();

		// Collect rules from multiple sources
		const allRulesArrays: RulesArray[] = [];

		// 1. Rules from NEW features being granted at this level
		if (classFeatures) {
			for (const feature of classFeatures.autoGrant) {
				const featureItem = feature as unknown as {
					name: string;
					system?: { rules?: unknown[] };
				};
				const rules = (featureItem.system?.rules ?? []) as unknown as RulesArray;
				if (rules.length > 0) allRulesArrays.push(rules);

				// Collect known schools from auto-grant rules on class features
				for (const rule of rules) {
					if (rule.type !== 'grantSpells') continue;
					if ((rule.mode as string) !== 'auto' && rule.mode !== undefined) continue;
					const schools = rule.schools as string[] | undefined;
					if (schools) {
						for (const school of schools) {
							if (school !== 'known') knownSchools.add(school);
						}
					}
				}
			}
		}

		// 2. Rules from EXISTING features already on the character
		for (const item of items) {
			if (item.type !== 'feature') continue;
			const rules = (item.system?.rules ?? []) as unknown as RulesArray;
			const hasGrantSpells = rules.some((r) => r.type === 'grantSpells');
			if (hasGrantSpells) {
				allRulesArrays.push(rules);

				// Collect known schools from auto-grant rules on existing features
				for (const rule of rules) {
					if (rule.type !== 'grantSpells') continue;
					if ((rule.mode as string) !== 'auto' && rule.mode !== undefined) continue;
					const schools = rule.schools as string[] | undefined;
					if (schools) {
						for (const school of schools) {
							if (school !== 'known') knownSchools.add(school);
						}
					}
				}
			}
		}

		const result = collectSpellGrants(
			allRulesArrays,
			resolvedSpellIndex,
			classIdentifier,
			levelingTo,
			ownedSpellUuids,
			knownSchools,
		);

		autoGrantedSpells = result.autoGrant;
		schoolSelections = result.schoolSelections;

		// Clean up selections for rules that no longer exist
		const validRuleIds = new Set(result.schoolSelections.map((s) => s.ruleId));
		for (const ruleId of selectedSchools.keys()) {
			if (!validRuleIds.has(ruleId)) {
				const newMap = new Map(selectedSchools);
				newMap.delete(ruleId);
				selectedSchools = newMap;
			}
		}
	});

	// Get all spell UUIDs that should be granted (auto + from school selections)
	function getGrantedSpellUuids(): string[] {
		const uuids: string[] = autoGrantedSpells.map((s) => s.uuid);

		if (!resolvedSpellIndex) return uuids;

		const seen = new Set(uuids);
		for (const group of schoolSelections) {
			const schools = selectedSchools.get(group.ruleId);
			if (!schools || schools.length === 0) continue;

			const spells = getSpellsFromIndex(resolvedSpellIndex, schools, group.tiers, {
				utilityOnly: group.utilityOnly,
				forClass: group.forClass,
			});

			for (const spell of spells) {
				if (!seen.has(spell.uuid)) {
					seen.add(spell.uuid);
					uuids.push(spell.uuid);
				}
			}
		}

		return uuids;
	}

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

	const spellSelectionsComplete = $derived.by(() => {
		for (const group of schoolSelections) {
			const selected = selectedSchools.get(group.ruleId) ?? [];
			if (selected.length < group.count) return false;
			if (!confirmedSchools.has(group.ruleId)) return false;
		}
		return true;
	});

	const skillPointChangesAssigned = $derived.by(() => {
		return (
			Object.values(skillPointChanges).reduce<number>((acc, change) => acc + (change ?? 0), 0) === 1
		);
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
			classFeaturesComplete &&
			spellSelectionsComplete
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
			spellUuids: getGrantedSpellUuids(),
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
		get autoGrantedSpells() {
			return autoGrantedSpells;
		},
		get schoolSelections() {
			return schoolSelections;
		},
		get resolvedSpellIndex() {
			return resolvedSpellIndex;
		},
		get selectedSchools() {
			return selectedSchools;
		},
		set selectedSchools(v: Map<string, string[]>) {
			selectedSchools = v;
		},
		get confirmedSchools() {
			return confirmedSchools;
		},
		set confirmedSchools(v: Set<string>) {
			confirmedSchools = v;
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
		set skillPointChanges(v: Record<string, number | null>) {
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
