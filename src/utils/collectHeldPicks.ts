import { toSnapshotId } from '../migration/compendiumSourceId.ts';

/** A feature item on the sheet, reduced to what a holding is read from. */
export interface HeldFeature {
	id: string;
	compendiumSource: string | null | undefined;
}

/** One pool of class options, reduced to the members it offers. */
export interface HeldPickPool {
	poolKey: string;
	candidateUuids: readonly string[];
}

/** The part of a level-up history entry the pick order is read from. */
export interface HeldPickHistoryEntry {
	level: number;
	grantedFeatureIds: readonly string[];
}

/**
 * The picks a character holds, per pool and then per member uuid.
 *
 * A pick is an item on the sheet whose compendium source is a member of the pool. Two items
 * with the same source are two picks. The two compendium namespaces are folded before the
 * match, and each member is keyed under the form the pool names it by. An item with no source,
 * or with a source no pool offers, is held nowhere. Every pool key is in the result, with an
 * empty map where the character holds none of its members.
 *
 * The history is read for one purpose only: to order the copies of a member, so that a copy
 * some entry names is released before one no entry names and a replacement can inherit that
 * entry. Ids an entry names come first, by the level of the earliest entry that names them,
 * then the ids no entry names in sheet order. This order must not grow into a fallback that
 * decides what is held or how much of it. Holdings come from the sheet alone.
 */
export default function collectHeldPicks(
	features: ReadonlyArray<HeldFeature>,
	pools: ReadonlyArray<HeldPickPool>,
	history: ReadonlyArray<HeldPickHistoryEntry>,
): Map<string, Map<string, string[]>> {
	const trackedRank = rankTrackedIds(history);
	const held = new Map<string, Map<string, string[]>>();

	for (const pool of pools) {
		const memberBySnapshotId = new Map<string, string>();
		for (const candidate of pool.candidateUuids) {
			memberBySnapshotId.set(toSnapshotId(candidate) ?? candidate, candidate);
		}

		const byMember = new Map<string, string[]>();
		for (const feature of features) {
			const source = feature.compendiumSource;
			if (!source) continue;

			const member = memberBySnapshotId.get(toSnapshotId(source) ?? source);
			if (!member) continue;

			const ids = byMember.get(member);
			if (ids) ids.push(feature.id);
			else byMember.set(member, [feature.id]);
		}

		for (const ids of byMember.values()) {
			ids.sort(
				(a, b) =>
					(trackedRank.get(a) ?? Number.MAX_SAFE_INTEGER) -
					(trackedRank.get(b) ?? Number.MAX_SAFE_INTEGER),
			);
		}

		held.set(pool.poolKey, byMember);
	}

	return held;
}

/** How many picks a pool's holdings come to, copies included. */
export function countHeldPicks(heldIdsByUuid: ReadonlyMap<string, readonly string[]>): number {
	let total = 0;
	for (const ids of heldIdsByUuid.values()) total += ids.length;
	return total;
}

/** Each id a history entry names, ranked by the level of the earliest entry that names it. */
function rankTrackedIds(history: ReadonlyArray<HeldPickHistoryEntry>): Map<string, number> {
	const rank = new Map<string, number>();

	const byLevel = [...history].sort((a, b) => a.level - b.level);
	for (const entry of byLevel) {
		for (const itemId of entry.grantedFeatureIds) {
			if (!rank.has(itemId)) rank.set(itemId, rank.size);
		}
	}

	return rank;
}
