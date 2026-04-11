import type { NimbleFeatureItem } from '#documents/item/feature.js';

/**
 * Shape of a feature's indexed fields in a compendium pack.
 */
interface FeatureIndexEntry {
	_id: string;
	uuid: string;
	type: string;
	name: string;
	system?: {
		class?: string;
		subclass?: boolean;
		gainedAtLevel?: number;
		gainedAtLevels?: number[];
		group?: string;
	};
}

/**
 * Get subclass features for a given class, subclass, and set of levels.
 * Scans world items and compendium packs for features where
 * subclass is true, class and group match, and gainedAtLevel is in the requested levels.
 */
export default async function getSubclassFeatures(
	classIdentifier: string,
	subclassIdentifier: string,
	levels: number[],
): Promise<NimbleFeatureItem[]> {
	const seen = new Set<string>();
	const uuids: string[] = [];

	function matchesLevel(system: {
		gainedAtLevel?: number | null;
		gainedAtLevels?: number[];
	}): boolean {
		if (system.gainedAtLevel && levels.includes(system.gainedAtLevel)) return true;
		if (system.gainedAtLevels) {
			for (const level of system.gainedAtLevels) {
				if (levels.includes(level)) return true;
			}
		}
		return false;
	}

	function addUuid(uuid: string): void {
		if (seen.has(uuid)) return;
		seen.add(uuid);
		uuids.push(uuid);
	}

	// Process world items
	for (const item of game.items) {
		if (item.type !== 'feature') continue;
		const featureItem = item as NimbleFeatureItem;
		const system = featureItem.system;

		if (!system.subclass) continue;
		if (system.class !== classIdentifier) continue;
		if (system.group !== subclassIdentifier) continue;
		if (!matchesLevel(system)) continue;

		addUuid(featureItem.uuid);
	}

	// Process compendium packs
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
			const entry = indexEntry as FeatureIndexEntry;
			if (entry.type !== 'feature') continue;

			const system = entry.system;
			if (!system?.subclass) continue;
			if (system.class !== classIdentifier) continue;
			if (system.group !== subclassIdentifier) continue;
			if (!matchesLevel(system)) continue;

			addUuid(entry.uuid);
		}
	}

	// Load full feature documents
	const features = await Promise.all(uuids.map((uuid) => fromUuid(uuid as `Item.${string}`)));

	return features.filter((f): f is NimbleFeatureItem => f != null);
}
