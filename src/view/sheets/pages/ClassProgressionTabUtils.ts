import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type {
	AbilityScoreDataEntry,
	ClassProgressionLevelData,
} from '#types/components/ClassProgressionTab.d.ts';
import { ABILITY_SCORE_LEVELS, SUBCLASS_LEVELS } from './ClassProgressionTabConstants.js';

type AbilityScoreRecord = { [K in (typeof ABILITY_SCORE_LEVELS)[number]]: AbilityScoreDataEntry };

export function formatGroupName(groupName: string): string {
	return groupName.replace(/-/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isSubclassLevel(level: number): boolean {
	return SUBCLASS_LEVELS.includes(level as (typeof SUBCLASS_LEVELS)[number]);
}

export function getAbilityScoreEntry(
	level: number,
	abilityScoreData: AbilityScoreRecord,
): AbilityScoreDataEntry | null {
	if (!ABILITY_SCORE_LEVELS.includes(level as (typeof ABILITY_SCORE_LEVELS)[number])) {
		return null;
	}
	return abilityScoreData[level as (typeof ABILITY_SCORE_LEVELS)[number]];
}

export function collectSelectionGroups(
	progressionData: Map<number, ClassProgressionLevelData>,
): Map<string, NimbleFeatureItem[]> {
	const groups = new Map<string, NimbleFeatureItem[]>();
	for (const [, levelData] of progressionData) {
		for (const [groupName, group] of levelData.selectionGroups) {
			if (!groups.has(groupName)) {
				groups.set(groupName, []);
			}
			const existing = groups.get(groupName)!;
			for (const feature of group.features) {
				if (!existing.some((f) => f.uuid === feature.uuid)) {
					existing.push(feature);
				}
			}
		}
	}
	return groups;
}

export function getGroupLevels(
	progressionData: Map<number, ClassProgressionLevelData>,
	groupName: string,
): number[] {
	const levels: number[] = [];
	for (const [level, levelData] of progressionData) {
		if (levelData.selectionGroups.has(groupName)) {
			levels.push(level);
		}
	}
	return levels.sort((a, b) => a - b);
}
