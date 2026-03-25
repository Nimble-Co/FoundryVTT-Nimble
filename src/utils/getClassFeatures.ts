import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Checks if a feature item matches the given class and level criteria.
 */
function matchesClassAndLevel(
	featureItem: NimbleFeatureItem,
	classIdentifier: string,
	level: number,
): boolean {
	const system = featureItem.system;

	// Filter by class identifier and exclude subclass features
	if (system.class !== classIdentifier || system.subclass) return false;

	// Check if feature is available at this level
	return system.gainedAtLevel === level || system.gainedAtLevels?.includes(level) === true;
}

export default async function getClassFeatures(
	classIdentifier: string,
	level: number,
): Promise<ClassFeatureResult> {
	const result: ClassFeatureResult = {
		autoGrant: [],
		selectionGroups: new Map(),
	};

	if (!classIdentifier || level < 1) {
		return result;
	}

	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();

	// Process world items - filter by class before checking level to reduce work
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		if (!matchesClassAndLevel(featureItem, classIdentifier, level)) continue;

		const groupName = featureItem.system.group || 'ungrouped';
		if (!featuresByGroup.has(groupName)) {
			featuresByGroup.set(groupName, []);
		}
		featuresByGroup.get(groupName)!.push(featureItem);
	}

	// Process compendium packs - only Item packs can contain features
	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;

		// Collect feature UUIDs from this pack's index
		const featureUuids: string[] = [];
		for (const indexEntry of pack.index) {
			if ((indexEntry as object as { type?: string }).type === 'feature') {
				featureUuids.push(indexEntry.uuid);
			}
		}

		if (featureUuids.length === 0) continue;

		// Fetch features from this pack and filter by class/level
		const features = await Promise.all(
			featureUuids.map((uuid) => fromUuid(uuid as `Item.${string}`)),
		);

		for (const feature of features) {
			if (!feature) continue;

			const featureItem = feature as NimbleFeatureItem;
			if (!matchesClassAndLevel(featureItem, classIdentifier, level)) continue;

			const groupName = featureItem.system.group || 'ungrouped';
			if (!featuresByGroup.has(groupName)) {
				featuresByGroup.set(groupName, []);
			}
			featuresByGroup.get(groupName)!.push(featureItem);
		}
	}

	// Categorize groups: names ending with -progression are auto-grant, others are selection
	for (const [groupName, groupFeatures] of featuresByGroup) {
		if (groupName.endsWith('-progression')) {
			result.autoGrant.push(...groupFeatures);
		} else {
			result.selectionGroups.set(groupName, groupFeatures);
		}
	}

	return result;
}
