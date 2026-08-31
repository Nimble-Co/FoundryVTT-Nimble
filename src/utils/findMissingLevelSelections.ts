import getClassFeaturesFromIndex, { type ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

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

/** One level's demand on one pool. */
interface PoolRequirement {
	level: number;
	poolGroups: string[];
	requiredCount: number;
	displayName: string | null;
	optionLabel: string | null;
}

/** Order-independent identity for a pool, so the same groups always resolve to one bucket. */
function buildPoolKey(groups: readonly string[]): string {
	return [...groups].sort().join('+');
}

/**
 * Every feature in the index that belongs to one of `poolGroups`, deduplicated by UUID.
 *
 * A pool spans the levels it is offered at, so the whole level map is scanned rather than a
 * single level. `lookupKeys` covers both index shapes: features that carry a class are indexed
 * under the class identifier, features that do not are indexed under their group.
 */
function collectPoolCandidates(
	index: ClassFeatureIndex,
	lookupKeys: readonly string[],
	poolGroups: readonly string[],
): string[] {
	const groupSet = new Set(poolGroups);
	const seen = new Set<string>();
	const uuids: string[] = [];

	for (const key of lookupKeys) {
		const levelMap = index.get(key);
		if (!levelMap) continue;

		for (const entries of levelMap.values()) {
			for (const entry of entries) {
				if (!groupSet.has(entry.group)) continue;
				if (seen.has(entry.uuid)) continue;
				seen.add(entry.uuid);
				uuids.push(entry.uuid);
			}
		}
	}

	return uuids;
}

/**
 * What each level from 1 to `classLevel` asks the character to pick from a feature pool.
 *
 * A level-up option whose applicable set holds more than one alternative is skipped: the
 * player's choice between alternatives is never stored, so which pool (if any) that level
 * demanded picks from cannot be recovered. Reporting it would mean warning about a character
 * that is fine.
 */
async function collectPoolRequirements(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
): Promise<PoolRequirement[]> {
	const requirements: PoolRequirement[] = [];

	for (let level = 1; level <= classLevel; level++) {
		// An empty owned set asks the resolver what the level demands, independent of what the
		// character has — the comparison against owned features happens below.
		const offered = await getClassFeaturesFromIndex(index, classIdentifier, level, {});

		for (const [groupName, group] of offered.selectionGroups) {
			requirements.push({
				level,
				poolGroups: [groupName],
				requiredCount: group.selectionCount,
				displayName: group.displayName ?? null,
				optionLabel: null,
			});
		}

		for (const feature of offered.optionFeatures) {
			const applicable = (feature.system.levelUpOptions ?? []).filter((option) =>
				isLevelUpOptionApplicable(option, level),
			);
			if (applicable.length !== 1) continue;

			const [option] = applicable;
			const selectionGroups = option.selectionGroups ?? [];
			if (selectionGroups.length === 0) continue;

			requirements.push({
				level,
				poolGroups: [...selectionGroups],
				// Compendium options may leave the count unset, meaning a single pick.
				requiredCount: option.selectionCount ?? 1,
				displayName: feature.name ?? null,
				optionLabel: option.label || null,
			});
		}
	}

	return requirements;
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
