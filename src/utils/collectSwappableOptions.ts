import collectOptionPoolCandidates from '#utils/collectOptionPoolCandidates.ts';
import collectOptionPoolRequirements, {
	buildOptionPoolKey,
	type OptionPoolRequirement,
} from '#utils/collectOptionPoolRequirements.ts';
import formatGroupName from '#utils/formatGroupName.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import { toSnapshotId } from '../migration/compendiumSourceId.js';

/** One pool of class options a character may re-pick from. */
export interface SwappableOptionPool {
	/** Order-independent identity for the pool. */
	poolKey: string;
	/** Feature `system.group` values the pool draws from. */
	poolGroups: string[];
	/** Heading to show, from the parent feature (e.g. "Savage Arsenal"). */
	displayName: string;
	/** The level-up option's own wording (e.g. "Choose a Savage Arsenal Ability"). */
	optionLabel: string | null;
	/** Levels that contributed picks, ascending. */
	levels: number[];
	/** How many picks the character holds from this pool, which a swap must preserve. */
	pickCount: number;
	/** Every member of the pool, held or not. */
	candidateUuids: string[];
	/**
	 * Member uuid to the embedded item ids that are picks of it, oldest granting level first.
	 * Only members with at least one pick appear.
	 */
	pickIdsByUuid: ReadonlyMap<string, string[]>;
	/** Members a character may hold more than one pick of. */
	repeatableUuids: string[];
}

/**
 * The option pools a character may re-pick from at their current level.
 *
 * Picks are reported per pool rather than per level, because which level bought which pick
 * is not recorded anywhere: the level-up dialog discards the option a player chose and keeps
 * only the granted item. Summing the levels is therefore the only honest presentation, and it
 * is the one `findMissingLevelSelections` already settled on for the same reason.
 *
 * A pick is an item the level-up history recorded, handed in as `pickIdsBySource`: for each
 * compendium source, the item ids that stand for picks of it. Two ids under one source are
 * two picks, which is how an option taken at two levels is counted twice. An item on the sheet
 * that no entry recorded is not in that map and so is not a pick. A pool the character owes
 * picks from belongs to the level correction dialog, not here.
 *
 * A source is matched to a member with the compendium namespaces folded, because a stored
 * source and a pack rule can name the same document under the stable and the dev system ids.
 *
 * A level that offers a choice between alternatives contributes all of them: every group any
 * alternative draws from, and every item an alternative grants outright, so a pick made either
 * way can be traded for the other. An alternative that grants its item with duplicates allowed
 * marks that member repeatable, and the union across the pool's levels wins. Pools that share
 * a group are merged, because an item in two pools would count twice and a swap in one would
 * silently reach into the other.
 *
 * The offers are gathered by replaying levels 1 to `classLevel`, because a level-up option is
 * applicable at the exact levels it lists, and a pool offered at earlier levels only would
 * otherwise go unseen. Pool members are not level-gated, so the whole pool is offered at any
 * level.
 *
 * `allowedGroups` narrows the result to what the character's `optionSwap` rules cover; pass
 * `null` for every pool, which is what the sentinel `all` means.
 */
export default async function collectSwappableOptions(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	pickIdsBySource: ReadonlyMap<string, readonly string[]>,
	allowedGroups: ReadonlySet<string> | null,
): Promise<SwappableOptionPool[]> {
	if (!classIdentifier || classLevel < 1) return [];

	const requirements = await collectOptionPoolRequirements(index, classIdentifier, classLevel, {
		alternatives: 'union',
	});

	const buckets: OptionPoolBucket[] = [];
	for (const requirement of requirements) {
		const poolGroups = allowedGroups
			? requirement.poolGroups.filter((group) => allowedGroups.has(group))
			: requirement.poolGroups;
		if (poolGroups.length === 0) continue;

		mergeIntoBuckets(buckets, { ...requirement, poolGroups });
	}

	const pickIdsBySnapshot = foldSources(pickIdsBySource);
	const pools: SwappableOptionPool[] = [];

	for (const bucket of buckets) {
		const poolGroups = [...bucket.groups].sort();
		const extras = bucket.requirements.flatMap((requirement) => requirement.extraCandidateUuids);
		const candidateUuids = [
			...new Set([
				...collectOptionPoolCandidates(index, [classIdentifier, ...poolGroups], poolGroups),
				...extras,
			]),
		];
		// A pool with one member offers no alternative, so there is nothing to swap.
		if (candidateUuids.length < 2) continue;

		const pickIdsByUuid = new Map<string, string[]>();
		for (const uuid of candidateUuids) {
			const ids = pickIdsBySnapshot.get(toSnapshotId(uuid) ?? uuid);
			if (ids && ids.length > 0) pickIdsByUuid.set(uuid, [...ids]);
		}
		const pickCount = [...pickIdsByUuid.values()].reduce((total, ids) => total + ids.length, 0);
		// Nothing picked is nothing to swap.
		if (pickCount < 1) continue;

		const byLevel = [...bucket.requirements].sort((a, b) => a.level - b.level);
		const [first] = byLevel;
		const repeatable = new Set(byLevel.flatMap((requirement) => requirement.repeatableUuids));

		pools.push({
			poolKey: buildOptionPoolKey(poolGroups),
			poolGroups,
			displayName:
				joinDistinct(byLevel.map((requirement) => requirement.displayName)) ??
				poolGroups.map(formatGroupName).join(' / '),
			optionLabel: first.optionLabel,
			levels: [...new Set(byLevel.map((requirement) => requirement.level))].sort((a, b) => a - b),
			pickCount,
			candidateUuids,
			pickIdsByUuid,
			repeatableUuids: candidateUuids.filter((uuid) => repeatable.has(uuid)),
		});
	}

	return pools.sort((a, b) => a.levels[0] - b.levels[0] || a.poolKey.localeCompare(b.poolKey));
}

/** The picks keyed by their source folded onto the snapshot namespace. */
function foldSources(
	pickIdsBySource: ReadonlyMap<string, readonly string[]>,
): Map<string, string[]> {
	const folded = new Map<string, string[]>();
	for (const [source, ids] of pickIdsBySource) {
		const key = toSnapshotId(source) ?? source;
		const existing = folded.get(key);
		if (existing) existing.push(...ids);
		else folded.set(key, [...ids]);
	}
	return folded;
}

interface OptionPoolBucket {
	groups: Set<string>;
	requirements: OptionPoolRequirement[];
}

/** Adds a requirement to the bucket sharing a group with it, folding together any it bridges. */
function mergeIntoBuckets(buckets: OptionPoolBucket[], requirement: OptionPoolRequirement): void {
	const touching = buckets.filter((bucket) =>
		requirement.poolGroups.some((group) => bucket.groups.has(group)),
	);

	const merged: OptionPoolBucket = {
		groups: new Set(requirement.poolGroups),
		requirements: [requirement],
	};
	for (const bucket of touching) {
		for (const group of bucket.groups) merged.groups.add(group);
		merged.requirements.unshift(...bucket.requirements);
		buckets.splice(buckets.indexOf(bucket), 1);
	}

	buckets.push(merged);
}

/** The distinct names in order of first appearance, or `null` when there are none. */
function joinDistinct(names: ReadonlyArray<string | null>): string | null {
	const distinct = [...new Set(names.filter((name): name is string => Boolean(name)))];
	return distinct.length > 0 ? distinct.join(' / ') : null;
}
