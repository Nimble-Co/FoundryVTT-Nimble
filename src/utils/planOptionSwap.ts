import type { SwappableOptionPool } from '#utils/collectSwappableOptions.ts';
import countBy from '#utils/countBy.ts';

/** One item to grant, and the level-up history entry that should own it. */
export interface PlannedGrant {
	uuid: string;
	/** Index into `levelUpHistory` of the entry that recorded the pick being replaced. */
	historyIndex: number;
}

export interface OptionSwapPlan {
	/** Embedded item ids to delete. */
	deleteItemIds: string[];
	/** Compendium uuids to grant, paired with the history entry that should record them. */
	grants: PlannedGrant[];
	/** Pool keys whose selection changed, for reporting. */
	changedPoolKeys: string[];
	/**
	 * Pool keys whose swap was refused because a released pick is no longer in the history.
	 * Nothing is planned for them.
	 */
	refusedPoolKeys: string[];
}

interface HistoryEntryLike {
	grantedFeatureIds?: string[];
}

/**
 * Works out what to delete and what to grant so a character's picks match their selection.
 *
 * A selection is a multiset of member uuids, so the plan is a count difference per member: a
 * member whose count fell releases that many pick ids from the front of its list, which is
 * oldest first, so the most recent pick survives; a member whose count rose is granted that
 * many times. A replacement inherits the history entry of the pick it replaces, which is what
 * keeps level down correct: the entry keeps naming exactly what that level currently owns, and
 * level down never has to learn that a swap happened.
 *
 * A pool is only acted on when the selection holds exactly as many picks as the character
 * already has, so the releases and the grants always pair off. Every pick has a history entry
 * by definition, but an id can go stale between the offer and the rest, so a pool whose
 * released pick no entry holds is refused outright rather than granted a replacement that no
 * level would record.
 */
export default function planOptionSwap(
	pools: readonly SwappableOptionPool[],
	selections: ReadonlyMap<string, readonly string[]>,
	history: readonly HistoryEntryLike[],
): OptionSwapPlan {
	const deleteItemIds: string[] = [];
	const grants: PlannedGrant[] = [];
	const changedPoolKeys: string[] = [];
	const refusedPoolKeys: string[] = [];

	for (const pool of pools) {
		const selected = selections.get(pool.poolKey);
		if (!selected) continue;
		// A half-finished selection is not a swap. Acting on one would delete the pick the
		// player dropped and grant nothing back, quietly costing them an option.
		if (selected.length !== pool.pickCount) continue;

		const wanted = countBy(selected);

		const released: string[] = [];
		for (const [uuid, ids] of pool.pickIdsByUuid) {
			const keep = wanted.get(uuid) ?? 0;
			if (ids.length > keep) released.push(...ids.slice(0, ids.length - keep));
		}

		const added: string[] = [];
		for (const [uuid, count] of wanted) {
			const have = pool.pickIdsByUuid.get(uuid)?.length ?? 0;
			for (let extra = have; extra < count; extra += 1) added.push(uuid);
		}

		if (released.length === 0 && added.length === 0) continue;

		// The entry each released pick was recorded against, so its replacement can take its place.
		const vacatedIndices = released.map((itemId) =>
			history.findIndex((entry) => entry.grantedFeatureIds?.includes(itemId)),
		);
		if (vacatedIndices.some((index) => index < 0)) {
			refusedPoolKeys.push(pool.poolKey);
			continue;
		}

		changedPoolKeys.push(pool.poolKey);
		deleteItemIds.push(...released);
		added.forEach((uuid, position) => {
			grants.push({ uuid, historyIndex: vacatedIndices[position] });
		});
	}

	return { deleteItemIds, grants, changedPoolKeys, refusedPoolKeys };
}
