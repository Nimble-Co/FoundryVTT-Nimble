import type {
	AbilityScoreDataEntry,
	ClassProgressionLevelData,
} from '#types/components/ClassProgressionTab.d.ts';
import localize from '#utils/localize.js';
import { formatGroupName } from '../pages/ClassProgressionTabUtils.js';

function formatStats(stats: readonly string[] | string[]): string {
	return stats
		.map((stat) => localize(`NIMBLE.abilityScoreAbbreviations.${stat}`).toUpperCase())
		.join(' or ');
}

// <hr> splits base description from level upgrades; upgrade blocks use "<p>Level N: ...</p>"
export function getLevelSpecificDescription(
	description: string,
	currentLevel: number,
	baseLevel: number,
): string {
	if (!description) return '';

	if (currentLevel === baseLevel) {
		const hrIndex = description.indexOf('<hr');
		return hrIndex !== -1 ? description.substring(0, hrIndex).trim() : description;
	}

	const levelPattern = new RegExp(
		`<p>\\s*Level\\s+${currentLevel}\\s*[:\\.]\\s*([^<]*(?:<(?!/p>)[^<]*)*)</p>`,
		'i',
	);
	const match = description.match(levelPattern);
	return match ? `<p>${match[1].trim()}</p>` : '';
}

export function getFeatureSummary(
	levelData: ClassProgressionLevelData,
	isEpicBoonLevel: boolean,
): string {
	const parts: string[] = [];

	for (const feature of levelData.autoGrant) {
		parts.push(feature.name);
	}
	for (const [groupName] of levelData.selectionGroups) {
		parts.push(formatGroupName(groupName));
	}
	if (isEpicBoonLevel) {
		parts.push(localize('NIMBLE.classSheet.progressionEpicBoonLabel'));
	}

	return parts.join(', ');
}

export function getStatIncreaseDescription(
	abilityScoreEntry: AbilityScoreDataEntry | null,
	keyAbilityScores: string[],
	secondaryAbilityScores: string[],
): string {
	if (!abilityScoreEntry) return '';

	if (abilityScoreEntry.statIncreaseType === 'primary') {
		return localize('NIMBLE.classSheet.progressionKeyStatIncrease', {
			stats: formatStats(keyAbilityScores),
		});
	}
	if (abilityScoreEntry.statIncreaseType === 'secondary') {
		return localize('NIMBLE.classSheet.progressionSecondaryStatIncrease', {
			stats: formatStats(secondaryAbilityScores),
		});
	}
	return localize('NIMBLE.classSheet.progressionCapstoneIncrease');
}

export { formatGroupName };
