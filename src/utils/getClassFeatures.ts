import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Lightweight entry stored in the class feature index.
 * Contains only the data needed for lookups, not full documents.
 */
interface ClassFeatureIndexEntry {
	uuid: string;
	group: string;
}

/**
 * Index structure for fast class feature lookups.
 * Maps classIdentifier (or groupName for group-based features) → level → array of feature entries.
 */
export type ClassFeatureIndex = Map<string, Map<number, ClassFeatureIndexEntry[]>>;

/**
 * Shape of a feature's indexed fields in a compendium pack.
 * These fields are configured in init.ts via CONFIG.Item.compendiumIndexFields.
 */
interface FeatureIndexEntry {
	_id: string;
	uuid: string;
	type: string;
	name: string;
	system?: {
		class?: string;
		subclass?: string;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		group?: string;
	};
}

/**
 * Builds a class feature index by scanning all packs once.
 * Call this when opening the character creator, then use getClassFeaturesFromIndex
 * for instant lookups.
 *
 * Features are indexed by:
 * - Their `class` field if set (e.g., "berserker")
 * - Their `group` field if class is not set (e.g., "savage-arsenal")
 *
 * This allows features without a class to be looked up by group name,
 * which can then be matched against a class's groupIdentifiers.
 */
export async function buildClassFeatureIndex(): Promise<ClassFeatureIndex> {
	const index: ClassFeatureIndex = new Map();

	// Track seen UUIDs per key+level to avoid duplicates
	const seen = new Map<string, Set<string>>();

	/**
	 * Adds a feature entry to the index for a specific key (class or group) and level.
	 * Deduplicates by UUID to handle features with both gainedAtLevel and gainedAtLevels.
	 */
	function addToIndex(key: string, level: number, entry: ClassFeatureIndexEntry): boolean {
		const lookupKey = `${key}:${level}`;
		if (!seen.has(lookupKey)) {
			seen.set(lookupKey, new Set());
		}
		if (seen.get(lookupKey)!.has(entry.uuid)) {
			return false; // Already added
		}
		seen.get(lookupKey)!.add(entry.uuid);

		if (!index.has(key)) {
			index.set(key, new Map());
		}
		const levelMap = index.get(key)!;
		if (!levelMap.has(level)) {
			levelMap.set(level, []);
		}
		levelMap.get(level)!.push(entry);
		return true;
	}

	/**
	 * Processes a feature and adds it to the index.
	 * Features with a class are indexed by class.
	 * Features without a class but with a group are indexed by group.
	 */
	function processFeature(
		uuid: string,
		system: {
			class?: string;
			subclass?: boolean | string;
			gainedAtLevel?: number | null;
			gainedAtLevels?: number[];
			group?: string;
		},
	): void {
		// Skip subclass features
		if (system.subclass) return;

		// Determine the index key: use class if set, otherwise use group
		const indexKey = system.class || system.group;
		if (!indexKey) return;

		const entry: ClassFeatureIndexEntry = {
			uuid,
			group: system.group || 'ungrouped',
		};

		// Add to index for gainedAtLevel
		if (system.gainedAtLevel) {
			addToIndex(indexKey, system.gainedAtLevel, entry);
		}

		// Add to index for each level in gainedAtLevels
		if (system.gainedAtLevels) {
			for (const level of system.gainedAtLevels) {
				addToIndex(indexKey, level, entry);
			}
		}
	}

	// Process world items
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		processFeature(featureItem.uuid, featureItem.system);
	}

	// Process compendium packs
	// Must call getIndex() with explicit fields to ensure custom fields are loaded
	const indexFields = [
		'system.class',
		'system.subclass',
		'system.gainedAtLevel',
		'system.gainedAtLevels',
		'system.group',
	] as string[];
	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;

		// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as FeatureIndexEntry;
			if (packEntry.type !== 'feature') continue;
			if (!packEntry.system) continue;

			processFeature(packEntry.uuid, packEntry.system);
		}
	}

	return index;
}

/**
 * Gets class features using a pre-built index for instant lookups.
 * Use this after building the index with buildClassFeatureIndex().
 *
 * @param index - The pre-built feature index
 * @param classIdentifier - The class identifier (e.g., "berserker")
 * @param level - The level to get features for
 * @param groupIdentifiers - Optional array of group identifiers to also look up (e.g., ["savage-arsenal"])
 */
export default async function getClassFeaturesFromIndex(
	index: ClassFeatureIndex,
	classIdentifier: string,
	level: number,
	groupIdentifiers: string[] = [],
): Promise<ClassFeatureResult> {
	const result: ClassFeatureResult = {
		autoGrant: [],
		selectionGroups: new Map(),
	};

	if (!classIdentifier || level < 1) {
		return result;
	}

	// Collect entries from the class identifier and all group identifiers
	const allEntries: ClassFeatureIndexEntry[] = [];
	const seenUuids = new Set<string>();

	// Look up by class identifier
	const classLevelMap = index.get(classIdentifier);
	const classEntries = classLevelMap?.get(level) ?? [];
	for (const entry of classEntries) {
		if (!seenUuids.has(entry.uuid)) {
			seenUuids.add(entry.uuid);
			allEntries.push(entry);
		}
	}

	// Look up by each group identifier
	for (const groupId of groupIdentifiers) {
		const groupLevelMap = index.get(groupId);
		const groupEntries = groupLevelMap?.get(level) ?? [];
		for (const entry of groupEntries) {
			if (!seenUuids.has(entry.uuid)) {
				seenUuids.add(entry.uuid);
				allEntries.push(entry);
			}
		}
	}

	if (allEntries.length === 0) {
		return result;
	}

	// Fetch the matching feature documents
	const features = await Promise.all(
		allEntries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	// Group by category
	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();

	for (let i = 0; i < features.length; i++) {
		const feature = features[i];
		if (!feature) continue;

		const featureItem = feature as NimbleFeatureItem;
		const groupName = allEntries[i].group;

		if (!featuresByGroup.has(groupName)) {
			featuresByGroup.set(groupName, []);
		}
		featuresByGroup.get(groupName)!.push(featureItem);
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
