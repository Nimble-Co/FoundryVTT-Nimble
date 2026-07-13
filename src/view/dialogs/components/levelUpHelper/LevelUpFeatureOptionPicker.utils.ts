import type { NimbleFeatureItem } from '#documents/item/feature.js';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/**
 * Loads the selectable sub-item features offered by an option's selection groups.
 *
 * Reuses the pre-built class-feature `index` (rather than re-scanning every pack on each
 * option change) to find the `feature` items belonging to `classId` whose group is one of
 * `selectionGroups`. Class features are indexed under the class key, so we collect the
 * pool members across every level the class offers them; subclass features are absent from
 * the index by construction. Owned items are filtered out. Returns the resolved documents,
 * deduplicated by UUID.
 */
export default async function loadOptionSubItems(
	index: ClassFeatureIndex | null,
	classId: string | undefined,
	selectionGroups: readonly string[],
	ownedItemUuids: ReadonlySet<string>,
): Promise<NimbleFeatureItem[]> {
	if (!index || !classId) return [];

	const groupSet = new Set(selectionGroups);
	const seenUuids = new Set<string>();
	const uuids: string[] = [];

	const levelMap = index.get(classId);
	if (levelMap) {
		for (const entries of levelMap.values()) {
			for (const entry of entries) {
				if (!groupSet.has(entry.group)) continue;
				if (seenUuids.has(entry.uuid)) continue;
				seenUuids.add(entry.uuid);
				uuids.push(entry.uuid);
			}
		}
	}

	const documents = await Promise.all(uuids.map((uuid) => fromUuid(uuid as `Item.${string}`)));

	const results: NimbleFeatureItem[] = [];
	for (const doc of documents) {
		if (doc) results.push(doc as NimbleFeatureItem);
	}

	return results.filter((item) => !ownedItemUuids.has(item.uuid));
}
