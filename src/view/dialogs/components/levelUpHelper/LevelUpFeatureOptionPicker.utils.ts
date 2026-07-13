import type { NimbleFeatureItem } from '#documents/item/feature.js';

/**
 * Loads the selectable sub-item features offered by an option's selection groups.
 *
 * Scans the compendium packs for `feature` items belonging to `classId` whose group
 * is one of `selectionGroups`, skipping subclass features and any item the actor
 * already owns. Returns the resolved documents in pack order, deduplicated by UUID.
 */
export default async function loadOptionSubItems(
	classId: string | undefined,
	selectionGroups: readonly string[],
	ownedItemUuids: ReadonlySet<string>,
): Promise<NimbleFeatureItem[]> {
	const groupSet = new Set(selectionGroups);
	const results: NimbleFeatureItem[] = [];
	const seenUuids = new Set<string>();
	const indexFields = ['system.class', 'system.group', 'system.subclass'] as string[];

	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;
		// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const entry of packIndex) {
			const e = entry as {
				uuid: string;
				type: string;
				system?: { class?: string; group?: string; subclass?: boolean };
			};
			if (e.type !== 'feature') continue;
			if (e.system?.class !== classId) continue;
			if (e.system?.subclass) continue;
			if (!groupSet.has(e.system?.group ?? '')) continue;
			if (seenUuids.has(e.uuid)) continue;
			seenUuids.add(e.uuid);
			const item = await fromUuid(e.uuid as `Item.${string}`);
			if (item) results.push(item as NimbleFeatureItem);
		}
	}

	return results.filter((item) => !ownedItemUuids.has(item.uuid));
}
