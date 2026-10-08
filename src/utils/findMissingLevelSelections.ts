import collectHeldPicks, {
	countHeldPicks,
	type HeldFeature,
	type HeldPickHistoryEntry,
} from '#utils/collectHeldPicks.ts';
import collectOptionPoolEntitlement, {
	type OptionPoolSlot,
} from '#utils/collectOptionPoolEntitlement.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/**
 * A pool of class features the character is still owed picks from, and the level whose
 * grant fell short.
 */
export interface MissingLevelSelection {
	/** Earliest level whose slot the character's holdings do not cover. */
	level: number;
	/** Stable key for the pool, used as the selection group key in the correction dialog. */
	poolKey: string;
	/** Feature `system.group` values the pool draws from. */
	poolGroups: string[];
	/** Heading to show, when the pool is named by a parent feature (e.g. "Sacred Graces"). */
	displayName: string | null;
	/** The level-up option's own wording, when the pool comes from one (e.g. "Choose 2 Sacred Graces"). */
	optionLabel: string | null;
	/** How many picks the character still owes from this pool. */
	missingCount: number;
	/** Pool candidates the character holds none of. */
	candidateUuids: string[];
}

/**
 * Finds the feature pools a character holds fewer picks from than their levels grant.
 *
 * The banner reads the class entitlement and the sheet's holdings, which is what the rest
 * window reads, so the two surfaces cannot report different numbers. A pick is an item on the
 * sheet whose compendium source is a member of the pool, duplicates included, so a hand-added
 * copy counts and a deleted one shows up as a shortfall.
 *
 * The shortfall for a pool is reported once, against the earliest slot the holdings do not
 * cover: that is where the sheet first falls behind, and merging the levels keeps the
 * correction dialog from offering the same candidate twice. It is capped at the number of
 * members the character holds none of, since a pick can only be offered from a pool that still
 * has members to offer.
 */
export default async function findMissingLevelSelections(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	features: ReadonlyArray<HeldFeature>,
	history: ReadonlyArray<HeldPickHistoryEntry>,
): Promise<MissingLevelSelection[]> {
	if (!classIdentifier || classLevel < 1) return [];

	const entitlements = await collectOptionPoolEntitlement(index, classIdentifier, classLevel, null);
	const heldByPool = collectHeldPicks(features, entitlements, history);

	const gaps: MissingLevelSelection[] = [];

	for (const entitlement of entitlements) {
		const heldIdsByUuid = heldByPool.get(entitlement.poolKey) ?? new Map<string, string[]>();
		const heldCount = countHeldPicks(heldIdsByUuid);
		if (heldCount >= entitlement.grantedCount) continue;

		const remainingUuids = entitlement.candidateUuids.filter((uuid) => !heldIdsByUuid.has(uuid));
		const missingCount = Math.min(entitlement.grantedCount - heldCount, remainingUuids.length);
		if (missingCount < 1) continue;

		const shortfall = findShortSlot(entitlement.slots, heldCount);
		if (!shortfall) continue;

		gaps.push({
			level: shortfall.level,
			poolKey: entitlement.poolKey,
			poolGroups: [...entitlement.poolGroups],
			displayName: entitlement.displayName,
			optionLabel: shortfall.optionLabel,
			missingCount,
			candidateUuids: remainingUuids,
		});
	}

	return gaps.sort((a, b) => a.level - b.level || a.poolKey.localeCompare(b.poolKey));
}

/** The first slot the holdings run out on, allocating them across the slots in level order. */
function findShortSlot(
	slots: ReadonlyArray<OptionPoolSlot>,
	heldCount: number,
): OptionPoolSlot | undefined {
	let credit = heldCount;

	for (const slot of slots) {
		if (credit < slot.count) return slot;
		credit -= slot.count;
	}

	return undefined;
}
