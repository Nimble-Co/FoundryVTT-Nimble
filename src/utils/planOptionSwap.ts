import type { SwappableOptionPool } from '#utils/collectSwappableOptions.ts';
import countBy from '#utils/countBy.ts';

/** One item to grant, and the level-up history entry that should own it. */
export interface PlannedGrant {
	uuid: string;
	/**
	 * Index into `levelUpHistory` of the entry that recorded the pick being replaced, or -1
	 * when no entry recorded it, which leaves the new item untracked.
	 */
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

/**
 * Whether a pool's selection is finished enough to act on.
 *
 * A selection with as many entries as the character holds is a trade. A selection that goes
 * past the holdings, while the holdings are below what the levels grant, is a fill, up to the
 * granted count. Anything else is incomplete, so browsing a pool costs the player nothing.
 */
export function isSelectionApplicable(
	selectedCount: number,
	heldCount: number,
	grantedCount: number,
): boolean {
	if (selectedCount === heldCount) return true;
	return heldCount < grantedCount && selectedCount > heldCount && selectedCount <= grantedCount;
}

interface HistoryEntryLike {
	grantedFeatureIds?: string[];
}

/**
 * Works out what to delete and what to grant so a character's holdings match their selection.
 *
 * A pool is acted on as a trade or as a fill. A trade holds as many picks as the character
 * already has. A fill takes more, up to what the levels grant, when the character holds fewer
 * than that. Any other selection is incomplete and changes nothing, so browsing a pool costs
 * the player nothing.
 *
 * A selection is a multiset of member uuids, so the plan is a count difference per member. A
 * member whose count fell releases that many held ids from the front of its list. A member
 * whose count rose is granted that many times.
 *
 * A replacement inherits the history entry of the pick it replaces when one exists, which
 * keeps level down correct: the entry keeps naming what that level currently owns. A released
 * pick that no entry names has none to pass on, and a fill replaces nothing, so those grants
 * are recorded nowhere and the new item is untracked, exactly like the item it replaced.
 * Nothing is refused.
 */
export default function planOptionSwap(
	pools: readonly SwappableOptionPool[],
	selections: ReadonlyMap<string, readonly string[]>,
	history: readonly HistoryEntryLike[],
): OptionSwapPlan {
	const deleteItemIds: string[] = [];
	const grants: PlannedGrant[] = [];
	const changedPoolKeys: string[] = [];

	for (const pool of pools) {
		const selected = selections.get(pool.poolKey);
		if (!selected) continue;
		if (!isSelectionApplicable(selected.length, pool.heldCount, pool.grantedCount)) continue;

		const wanted = countBy(selected);

		const released: string[] = [];
		for (const [uuid, ids] of pool.heldIdsByUuid) {
			const keep = wanted.get(uuid) ?? 0;
			if (ids.length > keep) released.push(...ids.slice(0, ids.length - keep));
		}

		const added: string[] = [];
		for (const [uuid, count] of wanted) {
			const have = pool.heldIdsByUuid.get(uuid)?.length ?? 0;
			for (let extra = have; extra < count; extra += 1) added.push(uuid);
		}

		if (released.length === 0 && added.length === 0) continue;

		// The entry each released pick was recorded against, so its replacement can take its
		// place. A pick no entry names has none, which `findIndex` already reports as -1.
		const vacatedIndices = released.map((itemId) =>
			history.findIndex((entry) => entry.grantedFeatureIds?.includes(itemId)),
		);

		changedPoolKeys.push(pool.poolKey);
		deleteItemIds.push(...released);
		added.forEach((uuid, position) => {
			grants.push({ uuid, historyIndex: vacatedIndices[position] ?? -1 });
		});
	}

	return { deleteItemIds, grants, changedPoolKeys };
}
