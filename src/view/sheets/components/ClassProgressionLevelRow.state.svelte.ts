import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassProgressionLevelRowProps } from '#types/components/ClassProgressionTab.d.ts';
import { ALL_STATS, EPIC_BOON_LEVEL } from './ClassProgressionLevelRowConstants.js';
import {
	formatGroupName,
	getFeatureSummary,
	getLevelSpecificDescription,
	getStatIncreaseDescription,
} from './ClassProgressionLevelRowUtils.js';

export function createClassProgressionLevelRowState(getProps: () => ClassProgressionLevelRowProps) {
	let isExpanded = $state(false);

	const secondaryAbilityScores = $derived(
		ALL_STATS.filter((stat) => !getProps().keyAbilityScores.includes(stat)),
	);

	const hasFeatures = $derived(
		getProps().levelData.autoGrant.length > 0 || getProps().levelData.selectionGroups.size > 0,
	);

	const isEpicBoonLevel = $derived(getProps().level === EPIC_BOON_LEVEL);

	const isExpandable = $derived(
		hasFeatures ||
			getProps().isSubclassLevel ||
			getProps().abilityScoreEntry !== null ||
			isEpicBoonLevel,
	);

	const featureSummary = $derived(getFeatureSummary(getProps().levelData, isEpicBoonLevel));

	const statIncreaseDescription = $derived(
		getStatIncreaseDescription(
			getProps().abilityScoreEntry,
			getProps().keyAbilityScores,
			secondaryAbilityScores,
		),
	);

	const levelDescriptions = $derived.by(() => {
		const result = new Map<string, string>();
		const { level, levelData } = getProps();
		for (const feature of levelData.autoGrant) {
			result.set(
				feature.uuid,
				getLevelSpecificDescription(
					feature.system?.description ?? '',
					level,
					feature.system?.gainedAtLevel ?? level,
				),
			);
		}
		return result;
	});

	function toggleExpanded(): void {
		if (isExpandable) {
			isExpanded = !isExpanded;
		}
	}

	function handleFeatureClick(event: MouseEvent, feature: NimbleFeatureItem): void {
		event.stopPropagation();
		getProps().onFeatureClick(feature);
	}

	function handleAddFeature(event: MouseEvent): void {
		event.stopPropagation();
		getProps().onAddFeature(getProps().level, getProps().classIdentifier);
	}

	return {
		get isExpanded() {
			return isExpanded;
		},
		get hasFeatures() {
			return hasFeatures;
		},
		get isEpicBoonLevel() {
			return isEpicBoonLevel;
		},
		get isExpandable() {
			return isExpandable;
		},
		get featureSummary() {
			return featureSummary;
		},
		get statIncreaseDescription() {
			return statIncreaseDescription;
		},
		get levelDescriptions() {
			return levelDescriptions;
		},
		formatGroupName,
		toggleExpanded,
		handleFeatureClick,
		handleAddFeature,
	};
}
