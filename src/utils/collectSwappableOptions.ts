import collectOptionPoolCandidates from '#utils/collectOptionPoolCandidates.ts';
import collectOptionPoolRequirements, {
	buildOptionPoolKey,
	type OptionPoolRequirement,
} from '#utils/collectOptionPoolRequirements.ts';
import formatGroupName from '#utils/formatGroupName.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

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
	/** Every member of the pool, owned or not. */
	candidateUuids: string[];
	/** The members the character currently holds. */
	ownedUuids: string[];
}

/**
 * The option pools a character may re-pick from at their current level.
 *
 * Picks are reported per pool rather than per level, because which level bought which pick
 * is not recorded anywhere: the level-up dialog discards the option a player chose and keeps
 * only the granted item. Summing the levels is therefore the only honest presentation, and it
 * is the one `findMissingLevelSelections` already settled on for the same reason.
 *
 * The pick count is what the character currently holds, not what their levels entitled them
 * to. A swap preserves the count rather than re-deriving it, and the two differ: a level that
 * offers a choice between options records nothing about which was taken.
 * A pool the character owes picks from belongs to the level correction dialog, not here.
 *
 * A level that offers a choice between alternatives contributes all of them: every group any
 * alternative draws from, and every item an alternative grants outright, so a pick made either
 * way can be traded for the other. Pools that share a group are merged, because an item in
 * two pools would count twice and a swap in one would silently reach into the other.
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
	ownedSourceUuids: ReadonlySet<string>,
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

		const ownedUuids = candidateUuids.filter((uuid) => ownedSourceUuids.has(uuid));
		// Nothing held is nothing to swap.
		if (ownedUuids.length < 1) continue;

		const byLevel = [...bucket.requirements].sort((a, b) => a.level - b.level);
		const [first] = byLevel;

		pools.push({
			poolKey: buildOptionPoolKey(poolGroups),
			poolGroups,
			displayName:
				joinDistinct(byLevel.map((requirement) => requirement.displayName)) ??
				poolGroups.map(formatGroupName).join(' / '),
			optionLabel: first.optionLabel,
			levels: [...new Set(byLevel.map((requirement) => requirement.level))].sort((a, b) => a - b),
			pickCount: ownedUuids.length,
			candidateUuids,
			ownedUuids,
		});
	}

	return pools.sort((a, b) => a.levels[0] - b.levels[0] || a.poolKey.localeCompare(b.poolKey));
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
