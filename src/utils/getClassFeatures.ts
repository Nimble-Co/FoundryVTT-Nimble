import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureResult } from '#types/components/ClassFeatureSelection.d.ts';

/**
 * Lightweight entry stored in the class feature index.
 * Contains only the data needed for lookups, not full documents.
 */
interface ClassFeatureIndexEntry {
	uuid: string;
	group: string;
	selectionCountByLevel: Record<string, number>;
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
		selectionCountByLevel?: Record<string, number>;
	};
}

/**
 * Options controlling how a class feature lookup is resolved.
 */
export interface GetClassFeaturesOptions {
	/**
	 * UUIDs and compendium-source UUIDs of features already owned by the actor.
	 * Any feature whose uuid appears here is filtered out of selection groups and auto-grants.
	 */
	ownedFeatureUuids?: ReadonlySet<string>;
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
			selectionCountByLevel: system.selectionCountByLevel ?? {},
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
		'system.selectionCountByLevel',
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
				selectionCountByLevel: system.selectionCountByLevel ?? {},
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
 * Resolves the required number of selections for a group at a specific level.
 *
 * The count is taken from the `selectionCountByLevel` field on each feature entry;
 * we use the max across features in the group so a single authoritative feature can
 * drive the count even if other entries in the group omit the field. Missing values
 * default to 1, preserving the pre-existing "choose one" behaviour.
 */
function resolveSelectionCount(entries: ClassFeatureIndexEntry[], level: number): number {
	const levelKey = String(level);
	let count = 1;

	for (const entry of entries) {
		const candidate = entry.selectionCountByLevel?.[levelKey];
		if (typeof candidate === 'number' && Number.isInteger(candidate) && candidate > count) {
			count = candidate;
		}
	}

	return count;
}

/**
 * Gets class features using a pre-built index for instant lookups.
 * Use this after building the index with buildClassFeatureIndex().
 */
export default async function getClassFeaturesFromIndex(
	index: ClassFeatureIndex,
	classIdentifier: string,
	level: number,
	options: GetClassFeaturesOptions = {},
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

	const ownedUuids = options.ownedFeatureUuids ?? new Set<string>();

	// Fetch the matching feature documents
	const features = await Promise.all(
		entries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	// Group by category, keeping the backing index entries in parallel so we can
	// compute per-group selection counts after filtering out owned features.
	const entriesByGroup = new Map<string, ClassFeatureIndexEntry[]>();
	const featuresByGroup = new Map<string, NimbleFeatureItem[]>();

	for (let i = 0; i < features.length; i++) {
		const feature = features[i];
		if (!feature) continue;
		if (ownedUuids.has(entries[i].uuid)) continue;

		const featureItem = feature as NimbleFeatureItem;
		const groupName = entries[i].group;

		if (!featuresByGroup.has(groupName)) {
			featuresByGroup.set(groupName, []);
			entriesByGroup.set(groupName, []);
		}
		featuresByGroup.get(groupName)!.push(featureItem);
		entriesByGroup.get(groupName)!.push(entries[i]);
	}

	// Categorize groups: names ending with -progression are auto-grant, others are selection
	for (const [groupName, groupFeatures] of featuresByGroup) {
		if (groupName.endsWith('-progression')) {
			result.autoGrant.push(...groupFeatures);
		} else {
			const groupEntries = entriesByGroup.get(groupName) ?? [];
			const selectionCount = resolveSelectionCount(groupEntries, level);
			result.selectionGroups.set(groupName, {
				features: groupFeatures,
				selectionCount,
			});
		}
	}

	return result;
}
