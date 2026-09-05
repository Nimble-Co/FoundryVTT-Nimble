import collectPoolCandidates from '#utils/collectPoolCandidates.ts';
import collectPoolRequirements, {
	buildPoolKey,
	type PoolRequirement,
} from '#utils/collectPoolRequirements.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/**
 * A pool of class features the character is still owed picks from, and the level whose
 * grant fell short.
 */
export interface MissingLevelSelection {
	/** Earliest level whose requirement the character's picks do not cover. */
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
	/** Pool candidates the character does not already own. */
	candidateUuids: string[];
}

/**
 * Finds the feature pools a character is still owed picks from.
 *
 * Compares what every level up to `classLevel` asks the character to pick against the pool
 * members they own, which catches a character who levelled through a level whose grant was
 * later corrected — a Shepherd who reached level 5 when it offered one Sacred Grace instead
 * of two keeps a single grace, and nothing on the sheet records the second as outstanding.
 *
 * The shortfall for a pool is reported once, against the earliest level whose requirement the
 * character's picks do not cover: that is where the data first went wrong, and merging the
 * levels keeps the correction dialog from offering the same candidate twice. It is capped at
 * the number of candidates left, since a pick can only be offered from a pool that still has
 * members to offer.
 */
export default async function findMissingLevelSelections(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	ownedSourceUuids: ReadonlySet<string>,
): Promise<MissingLevelSelection[]> {
	if (!classIdentifier || classLevel < 1) return [];

	const requirements = await collectPoolRequirements(index, classIdentifier, classLevel);

	const requirementsByPool = new Map<string, PoolRequirement[]>();
	for (const requirement of requirements) {
		const key = buildPoolKey(requirement.poolGroups);
		const bucket = requirementsByPool.get(key);
		if (bucket) bucket.push(requirement);
		else requirementsByPool.set(key, [requirement]);
	}

	const gaps: MissingLevelSelection[] = [];

	for (const [poolKey, poolRequirements] of requirementsByPool) {
		const poolGroups = poolRequirements[0].poolGroups;
		const candidateUuids = collectPoolCandidates(
			index,
			[classIdentifier, ...poolGroups],
			poolGroups,
		);

		const ownedCount = candidateUuids.filter((uuid) => ownedSourceUuids.has(uuid)).length;
		const remainingUuids = candidateUuids.filter((uuid) => !ownedSourceUuids.has(uuid));

		const requiredCount = poolRequirements.reduce((total, req) => total + req.requiredCount, 0);
		const missingCount = Math.min(requiredCount - ownedCount, remainingUuids.length);
		if (missingCount < 1) continue;

		// The first level the owned picks run out on: allocate them across the levels in order.
		let credit = ownedCount;
		let shortfall: PoolRequirement | undefined;
		for (const requirement of poolRequirements) {
			if (credit < requirement.requiredCount) {
				shortfall = requirement;
				break;
			}
			credit -= requirement.requiredCount;
		}
		if (!shortfall) continue;

		gaps.push({
			level: shortfall.level,
			poolKey,
			poolGroups: [...shortfall.poolGroups],
			displayName: shortfall.displayName,
			optionLabel: shortfall.optionLabel,
			missingCount,
			candidateUuids: remainingUuids,
		});
	}

	return gaps.sort((a, b) => a.level - b.level || a.poolKey.localeCompare(b.poolKey));
}
