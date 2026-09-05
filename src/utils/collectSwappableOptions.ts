import collectPoolCandidates from '#utils/collectPoolCandidates.ts';
import collectPoolRequirements, { buildPoolKey } from '#utils/collectPoolRequirements.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/** One pool of class options a character may re-pick from. */
export interface SwappableOptionPool {
	/** Order-independent identity for the pool. */
	poolKey: string;
	/** Feature `system.group` values the pool draws from. */
	poolGroups: string[];
	/** Heading to show, from the parent feature (e.g. "Savage Arsenal"). */
	displayName: string | null;
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
 * offers a choice between options records nothing about which was taken, so `collectPoolRequirements`
 * skips it, and a Commander's Combat Tactics would otherwise count one pick while holding six.
 * A pool the character owes picks from belongs to the level correction dialog, not here.
 *
 * The offers are gathered by replaying levels 1 to `classLevel`, because a level-up option is
 * applicable at the exact levels it lists — asking the resolver about level 10 alone returns
 * nothing for a Hunter whose Thrill of the Hunt is offered at 2, 4, 6, 8, 12 and 14. Pool
 * members are not level-gated, so the whole pool is offered at any level.
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

	const requirements = await collectPoolRequirements(index, classIdentifier, classLevel);

	const byPool = new Map<string, typeof requirements>();
	for (const requirement of requirements) {
		if (allowedGroups && !requirement.poolGroups.some((group) => allowedGroups.has(group))) {
			continue;
		}
		const key = buildPoolKey(requirement.poolGroups);
		const bucket = byPool.get(key);
		if (bucket) bucket.push(requirement);
		else byPool.set(key, [requirement]);
	}

	const pools: SwappableOptionPool[] = [];

	for (const [poolKey, poolRequirements] of byPool) {
		const { poolGroups } = poolRequirements[0];
		const candidateUuids = collectPoolCandidates(
			index,
			[classIdentifier, ...poolGroups],
			poolGroups,
		);
		// A pool with one member offers no alternative, so there is nothing to swap.
		if (candidateUuids.length < 2) continue;

		const ownedUuids = candidateUuids.filter((uuid) => ownedSourceUuids.has(uuid));
		// Nothing held is nothing to swap.
		if (ownedUuids.length < 1) continue;

		// The first requirement names the pool: later levels repeat the same option, so its
		// wording is the same, and the earliest one is what the character first saw.
		const [first] = poolRequirements;

		pools.push({
			poolKey,
			poolGroups: [...poolGroups],
			displayName: first.displayName,
			optionLabel: first.optionLabel,
			levels: [...new Set(poolRequirements.map((req) => req.level))].sort((a, b) => a - b),
			pickCount: ownedUuids.length,
			candidateUuids,
			ownedUuids,
		});
	}

	return pools.sort((a, b) => a.levels[0] - b.levels[0] || a.poolKey.localeCompare(b.poolKey));
}
