import type { ClassProgressionLevelData } from '#types/components/ClassProgressionTab.d.ts';

import getClassFeaturesFromIndex, {
	buildClassFeatureIndex,
	type ClassFeatureIndex,
} from './getClassFeatures.ts';

const MAX_LEVEL = 20;

/**
 * Builds progression data for all 20 levels of a class.
 * Uses the class feature index for efficient lookups.
 *
 * @param classIdentifier - The identifier of the class to get progression for
 * @param groupIdentifiers - Optional array of group identifiers for the class (e.g., ["savage-arsenal", "berserker-progression"])
 * @returns Map of level number to progression data for that level
 */
export default async function getClassProgressionData(
	classIdentifier: string,
	groupIdentifiers: string[] = [],
): Promise<Map<number, ClassProgressionLevelData>> {
	const progressionData = new Map<number, ClassProgressionLevelData>();

	if (!classIdentifier) {
		return progressionData;
	}

	// Build the feature index once
	const index: ClassFeatureIndex = await buildClassFeatureIndex();

	// Get features for all 20 levels
	for (let level = 1; level <= MAX_LEVEL; level++) {
		const features = await getClassFeaturesFromIndex(
			index,
			classIdentifier,
			level,
			groupIdentifiers,
		);

		progressionData.set(level, {
			level,
			autoGrant: features.autoGrant,
			selectionGroups: features.selectionGroups,
		});
	}

	return progressionData;
}
