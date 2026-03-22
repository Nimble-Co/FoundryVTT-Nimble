import type { NimbleFeatureItem } from '#documents/item/feature.js';

interface ClassFeatureResult {
	autoGrant: NimbleFeatureItem[];
	selectionGroups: Map<string, NimbleFeatureItem[]>;
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

	const featureUuids: string[] = [];

	// Get features from world items
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		featureUuids.push(item.uuid);
	}

	// Get features from compendium packs
	for (const pack of game.packs) {
		for (const document of pack.index) {
			if ((document as object as { type?: string }).type !== 'feature') continue;
			featureUuids.push(document.uuid);
		}
	}

	// Fetch all feature documents and filter
	const features = await Promise.all(
		featureUuids.map((uuid) => fromUuid(uuid as `Item.${string}`)),
	);

	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();

	for (const feature of features) {
		if (!feature) continue;

		const featureItem = feature as NimbleFeatureItem;
		const system = featureItem.system;

		// Filter by class identifier and exclude subclass features
		if (system.class !== classIdentifier || system.subclass) continue;

		// Check if feature is available at this level
		const availableAtLevel =
			system.gainedAtLevel === level || system.gainedAtLevels?.includes(level);

		if (!availableAtLevel) continue;

		// Group features by their group name
		const groupName = system.group || 'ungrouped';
		if (!featuresByGroup.has(groupName)) {
			featuresByGroup.set(groupName, []);
		}
		featuresByGroup.get(groupName)!.push(featureItem);
	}

	// Categorize groups: names ending with -progression are auto-grant, others are selection
	for (const [groupName, groupFeatures] of featuresByGroup) {
		if (groupName.endsWith('-progression')) {
			// Auto-grant: add all features from this group
			result.autoGrant.push(...groupFeatures);
		} else {
			// Selection group: player chooses one
			result.selectionGroups.set(groupName, groupFeatures);
		}
	}

	return result;
}
