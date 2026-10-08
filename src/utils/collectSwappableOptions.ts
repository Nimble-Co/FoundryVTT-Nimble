import collectHeldPicks, {
	countHeldPicks,
	type HeldFeature,
	type HeldPickHistoryEntry,
} from '#utils/collectHeldPicks.ts';
import collectOptionPoolEntitlement, {
	type OptionPoolEntitlement,
} from '#utils/collectOptionPoolEntitlement.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/** One pool of class options a character may re-pick from, with what they hold of it. */
export interface SwappableOptionPool extends OptionPoolEntitlement {
	/**
	 * Member uuid to the held item ids of that member, the ids a history entry names first.
	 * A member the character holds nothing of does not appear.
	 */
	heldIdsByUuid: ReadonlyMap<string, string[]>;
	/** How many picks the character holds from this pool. */
	heldCount: number;
}

/**
 * The option pools a character may re-pick from at their current level.
 *
 * A pool is the class entitlement plus what the sheet holds. The entitlement says which
 * members the levels offer and how many picks they grant. The holdings say which items the
 * character has of those members. A pick is a held item, so two items with one source are two
 * picks. The history is read for one purpose only: to order the copies of a member.
 *
 * `allowedGroups` narrows the result to what the character's `optionSwap` rules cover; pass
 * `null` for every pool, which is what the sentinel `all` means.
 */
export default async function collectSwappableOptions(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	features: ReadonlyArray<HeldFeature>,
	history: ReadonlyArray<HeldPickHistoryEntry>,
	allowedGroups: ReadonlySet<string> | null,
): Promise<SwappableOptionPool[]> {
	const entitlements = await collectOptionPoolEntitlement(
		index,
		classIdentifier,
		classLevel,
		allowedGroups,
	);
	const heldByPool = collectHeldPicks(features, entitlements, history);

	const pools: SwappableOptionPool[] = [];

	for (const entitlement of entitlements) {
		// A pool with one member offers no alternative, so there is nothing to swap.
		if (entitlement.candidateUuids.length < 2) continue;

		const heldIdsByUuid = heldByPool.get(entitlement.poolKey) ?? new Map<string, string[]>();
		const heldCount = countHeldPicks(heldIdsByUuid);

		pools.push({ ...entitlement, heldIdsByUuid, heldCount });
	}

	return pools;
}
