import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/**
 * Every feature in the index that belongs to one of `poolGroups`, deduplicated by UUID.
 *
 * A pool spans the levels it is offered at, so the whole level map is scanned rather than a
 * single level. `lookupKeys` covers both index shapes: features that carry a class are indexed
 * under the class identifier, features that do not are indexed under their group.
 */
export default function collectPoolCandidates(
	index: ClassFeatureIndex,
	lookupKeys: readonly string[],
	poolGroups: readonly string[],
): string[] {
	const groupSet = new Set(poolGroups);
	const seen = new Set<string>();
	const uuids: string[] = [];

	for (const key of lookupKeys) {
		const levelMap = index.get(key);
		if (!levelMap) continue;

		for (const entries of levelMap.values()) {
			for (const entry of entries) {
				if (!groupSet.has(entry.group)) continue;
				if (seen.has(entry.uuid)) continue;
				seen.add(entry.uuid);
				uuids.push(entry.uuid);
			}
		}
	}

	return uuids;
}
