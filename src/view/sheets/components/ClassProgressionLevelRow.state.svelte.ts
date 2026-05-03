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

	let levelDescriptions = $state<Map<string, string>>(new Map());

	$effect(() => {
		const { level, levelData } = getProps();
		const features = levelData.autoGrant;

		async function enrichDescriptions(): Promise<void> {
			const result = new Map<string, string>();
			await Promise.all(
				features.map(async (feature) => {
					const raw = getLevelSpecificDescription(
						feature.system?.description ?? '',
						level,
						feature.system?.gainedAtLevel ?? level,
					);
					if (!raw) return;
					result.set(feature.uuid, await TextEditor.enrichHTML(raw));
				}),
			);
			levelDescriptions = result;
		}

		enrichDescriptions();
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

	function handleDeleteWorldItem(event: MouseEvent, feature: NimbleFeatureItem): void {
		event.stopPropagation();
		getProps().onDeleteWorldItem(feature.uuid, feature.name);
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
		handleDeleteWorldItem,
		handleAddFeature,
	};
}
