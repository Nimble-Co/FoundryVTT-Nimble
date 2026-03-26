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
 * Maps classIdentifier → level → array of feature entries.
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
 */
export async function buildClassFeatureIndex(): Promise<ClassFeatureIndex> {
	const index: ClassFeatureIndex = new Map();

	// Track seen UUIDs per class+level to avoid duplicates
	const seen = new Map<string, Set<string>>();

	/**
	 * Adds a feature entry to the index for a specific class and level.
	 * Deduplicates by UUID to handle features with both gainedAtLevel and gainedAtLevels.
	 */
	function addToIndex(classId: string, level: number, entry: ClassFeatureIndexEntry): boolean {
		const key = `${classId}:${level}`;
		if (!seen.has(key)) {
			seen.set(key, new Set());
		}
		if (seen.get(key)!.has(entry.uuid)) {
			return false; // Already added
		}
		seen.get(key)!.add(entry.uuid);

		if (!index.has(classId)) {
			index.set(classId, new Map());
		}
		const levelMap = index.get(classId)!;
		if (!levelMap.has(level)) {
			levelMap.set(level, []);
		}
		levelMap.get(level)!.push(entry);
		return true;
	}

	// Process world items
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		const system = featureItem.system;

		// Skip features without a class or with a subclass (those are subclass features)
		if (!system.class || system.subclass) continue;

		const entry: ClassFeatureIndexEntry = {
			uuid: featureItem.uuid,
			group: system.group || 'ungrouped',
		};

		// Add to index for gainedAtLevel
		if (system.gainedAtLevel) {
			addToIndex(system.class, system.gainedAtLevel, entry);
		}

		// Add to index for each level in gainedAtLevels
		if (system.gainedAtLevels) {
			for (const level of system.gainedAtLevels) {
				addToIndex(system.class, level, entry);
			}
		}
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

			const system = packEntry.system;
			if (!system?.class || system.subclass) continue;

			const entry: ClassFeatureIndexEntry = {
				uuid: packEntry.uuid,
				group: system.group || 'ungrouped',
			};

			// Add to index for gainedAtLevel
			if (system.gainedAtLevel) {
				addToIndex(system.class, system.gainedAtLevel, entry);
			}

			// Add to index for each level in gainedAtLevels
			if (system.gainedAtLevels) {
				for (const level of system.gainedAtLevels) {
					addToIndex(system.class, level, entry);
				}
			}
		}
	}

	return index;
}

/**
 * Gets class features using a pre-built index for instant lookups.
 * Use this after building the index with buildClassFeatureIndex().
 */
export default async function getClassFeaturesFromIndex(
	index: ClassFeatureIndex,
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

	// Instant lookup from index
	const levelMap = index.get(classIdentifier);
	const entries = levelMap?.get(level) ?? [];

	if (entries.length === 0) {
		return result;
	}

	// Fetch the matching feature documents
	const features = await Promise.all(
		entries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	// Group by category
	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();

	for (let i = 0; i < features.length; i++) {
		const feature = features[i];
		if (!feature) continue;

		const featureItem = feature as NimbleFeatureItem;
		const groupName = entries[i].group;

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
