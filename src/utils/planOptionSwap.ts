import type { SwappableOptionPool } from '#utils/collectSwappableOptions.ts';

/** One item to grant, and the level-up history entry that should own it. */
export interface PlannedGrant {
	uuid: string;
	/** Index into `levelUpHistory`, or -1 when no entry recorded the pick being replaced. */
	historyIndex: number;
}

export interface OptionSwapPlan {
	/** Embedded item ids to delete. */
	deleteItemIds: string[];
	/** Compendium uuids to grant, paired with the history entry that should record them. */
	grants: PlannedGrant[];
	/** Pool keys whose selection changed, for reporting. */
	changedPoolKeys: string[];
}

interface HistoryEntryLike {
	grantedFeatureIds?: string[];
}

/**
 * Works out what to delete and what to grant so a character's picks match their selection.
 *
 * A replacement inherits the history entry of the pick it replaces, which is what keeps level
 * down correct: the entry keeps naming exactly what that level currently owns, and level down
 * never has to learn that a swap happened.
 *
 * Removals and additions are paired in order within each pool. The pick count is fixed, so the
 * two lists are the same length in practice; a leftover addition falls back to the last entry
 * that holds a pick from the pool, and then to no entry at all rather than a wrong one.
 */
export default function planOptionSwap(
	pools: readonly SwappableOptionPool[],
	selections: ReadonlyMap<string, readonly string[]>,
	itemIdByUuid: ReadonlyMap<string, string>,
	history: readonly HistoryEntryLike[],
): OptionSwapPlan {
	const deleteItemIds: string[] = [];
	const grants: PlannedGrant[] = [];
	const changedPoolKeys: string[] = [];

	for (const pool of pools) {
		const selected = selections.get(pool.poolKey);
		if (!selected) continue;

		const owned = new Set(pool.ownedUuids);
		const wanted = new Set(selected);

		const removedUuids = pool.ownedUuids.filter((uuid) => !wanted.has(uuid));
		const addedUuids = selected.filter((uuid) => !owned.has(uuid));
		if (removedUuids.length === 0 && addedUuids.length === 0) continue;

		changedPoolKeys.push(pool.poolKey);

		const removedItemIds = removedUuids
			.map((uuid) => itemIdByUuid.get(uuid))
			.filter((id): id is string => Boolean(id));
		deleteItemIds.push(...removedItemIds);

		// The entry each removed pick was recorded against, so its replacement can take its place.
		const vacatedIndices = removedItemIds.map((itemId) =>
			history.findIndex((entry) => entry.grantedFeatureIds?.includes(itemId)),
		);

		const fallbackIndex = lastEntryHolding(history, pool, itemIdByUuid);

		addedUuids.forEach((uuid, position) => {
			const vacated = vacatedIndices[position];
			grants.push({
				uuid,
				historyIndex: vacated === undefined || vacated < 0 ? fallbackIndex : vacated,
			});
		});
	}

	return { deleteItemIds, grants, changedPoolKeys };
}

/** The latest history entry that records a pick from this pool, or -1 when none does. */
function lastEntryHolding(
	history: readonly HistoryEntryLike[],
	pool: SwappableOptionPool,
	itemIdByUuid: ReadonlyMap<string, string>,
): number {
	const poolItemIds = new Set(
		pool.ownedUuids.map((uuid) => itemIdByUuid.get(uuid)).filter((id): id is string => Boolean(id)),
	);

	for (let index = history.length - 1; index >= 0; index -= 1) {
		if (history[index].grantedFeatureIds?.some((id) => poolItemIds.has(id))) return index;
	}

	return -1;
}
