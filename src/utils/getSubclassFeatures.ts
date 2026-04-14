import type { NimbleFeatureItem } from '#documents/item/feature.js';

interface SubclassFeatureIndexEntry {
	uuid: string;
}

/**
 * Index structure for fast subclass feature lookups.
 * Maps classIdentifier → subclassIdentifier → level → array of feature entries.
 */
export type SubclassFeatureIndex = Map<
	string,
	Map<string, Map<number, SubclassFeatureIndexEntry[]>>
>;

/**
 * Shape of a feature's indexed fields in a compendium pack.
 * Must stay in sync with the fields passed to pack.getIndex().
 */
interface FeatureIndexEntry {
	uuid: string;
	type: string;
	system?: {
		class?: string;
		subclass?: boolean;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		group?: string;
	};
}

function addToIndex(
	index: SubclassFeatureIndex,
	classId: string,
	subclassId: string,
	level: number,
	entry: SubclassFeatureIndexEntry,
): void {
	let classMap = index.get(classId);
	if (!classMap) {
		classMap = new Map();
		index.set(classId, classMap);
	}
	let subclassMap = classMap.get(subclassId);
	if (!subclassMap) {
		subclassMap = new Map();
		classMap.set(subclassId, subclassMap);
	}
	let levelArray = subclassMap.get(level);
	if (!levelArray) {
		levelArray = [];
		subclassMap.set(level, levelArray);
	}
	if (levelArray.some((e) => e.uuid === entry.uuid)) return;
	levelArray.push(entry);
}

/**
 * Builds a subclass feature index by scanning world items and compendium packs.
 * Subclass features are identified by `system.subclass === true` and grouped
 * under their parent class and subclass identifier (stored in `system.group`).
 */
export async function buildSubclassFeatureIndex(): Promise<SubclassFeatureIndex> {
	const index: SubclassFeatureIndex = new Map();

	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		const system = featureItem.system;

		if (!system.subclass || !system.class || !system.group) continue;

		const entry: SubclassFeatureIndexEntry = { uuid: featureItem.uuid };

		if (system.gainedAtLevel) {
			addToIndex(index, system.class, system.group, system.gainedAtLevel, entry);
		}
		if (system.gainedAtLevels) {
			for (const level of system.gainedAtLevels) {
				addToIndex(index, system.class, system.group, level, entry);
			}
		}
	}

	// Explicit fields required so custom system fields are included in the pack index
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
			if (!system?.subclass || !system.class || !system.group) continue;

			const entry: SubclassFeatureIndexEntry = { uuid: packEntry.uuid };

			if (system.gainedAtLevel) {
				addToIndex(index, system.class, system.group, system.gainedAtLevel, entry);
			}
			if (system.gainedAtLevels) {
				for (const level of system.gainedAtLevels) {
					addToIndex(index, system.class, system.group, level, entry);
				}
			}
		}
	}

	return index;
}

/**
 * Gets subclass features granted at a specific level for a given class/subclass pairing.
 * Returns an empty array when no features match, so callers can safely skip granting.
 */
export default async function getSubclassFeaturesFromIndex(
	index: SubclassFeatureIndex,
	classIdentifier: string,
	subclassIdentifier: string,
	level: number,
): Promise<NimbleFeatureItem[]> {
	if (!classIdentifier || !subclassIdentifier || level < 1) {
		return [];
	}

	const entries = index.get(classIdentifier)?.get(subclassIdentifier)?.get(level) ?? [];
	if (entries.length === 0) return [];

	const features = await Promise.all(
		entries.map((entry) => fromUuid(entry.uuid as `Item.${string}`)),
	);

	return features.filter((feature): feature is NimbleFeatureItem => feature !== null);
}
