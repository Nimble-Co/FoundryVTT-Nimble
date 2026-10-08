import collectOptionPoolCandidates from '#utils/collectOptionPoolCandidates.ts';
import collectOptionPoolRequirements, {
	buildOptionPoolKey,
	type OptionPoolRequirement,
} from '#utils/collectOptionPoolRequirements.ts';
import formatGroupName from '#utils/formatGroupName.ts';
import type { ClassFeatureIndex } from '#utils/getClassFeatures.ts';

/** One level's offer from a pool: the groups it names, and how many picks it asks for. */
export interface OptionPoolSlot {
	level: number;
	/** The groups this level names, before the merge with the levels it shares a group with. */
	groups: string[];
	count: number;
	optionLabel: string | null;
}

/** What one pool grants a character of a given class and level. */
export interface OptionPoolEntitlement {
	/** Order-independent identity for the pool. */
	poolKey: string;
	/** Feature `system.group` values the pool draws from. */
	poolGroups: string[];
	/** Heading to show, from the parent feature. */
	displayName: string;
	/** The level-up option's own wording, from the first level that offers the pool. */
	optionLabel: string | null;
	/** Levels that offer the pool, ascending and distinct. */
	levels: number[];
	/** How many picks the levels grant in total. */
	grantedCount: number;
	/** One entry per level that offers the pool, ascending. */
	slots: OptionPoolSlot[];
	/** Every member of the pool, plus the items its alternatives grant outright. */
	candidateUuids: string[];
	/** Members a character may hold more than one pick of. */
	repeatableUuids: string[];
}

/**
 * What a class grants a character from each of its option pools, up to `classLevel`.
 *
 * An entitlement says what the class gives. It says nothing about what a sheet holds. Two
 * characters of the same class and level have the same entitlement, however they were built.
 * A caller that wants the difference compares the entitlement to the items on the sheet.
 *
 * The offers are gathered by replaying levels 1 to `classLevel`, because a level-up option is
 * applicable at the exact levels it lists, and a pool offered at earlier levels only would
 * otherwise go unseen.
 *
 * Pools that share a group are merged, because an item in two pools would count twice.
 *
 * `allowedGroups` narrows the result to the groups named; pass `null` for every pool.
 */
export default async function collectOptionPoolEntitlement(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	allowedGroups: ReadonlySet<string> | null,
): Promise<OptionPoolEntitlement[]> {
	if (!classIdentifier || classLevel < 1) return [];

	const requirements = await collectOptionPoolRequirements(index, classIdentifier, classLevel);

	const buckets: OptionPoolBucket[] = [];
	for (const requirement of requirements) {
		const poolGroups = allowedGroups
			? requirement.poolGroups.filter((group) => allowedGroups.has(group))
			: requirement.poolGroups;
		if (poolGroups.length === 0) continue;

		mergeIntoBuckets(buckets, { ...requirement, poolGroups, slotGroups: requirement.poolGroups });
	}

	const entitlements: OptionPoolEntitlement[] = [];

	for (const bucket of buckets) {
		const byLevel = [...bucket.requirements].sort((a, b) => a.level - b.level);
		const poolGroups = orderByFirstLevel(bucket.groups, byLevel);
		const [first] = byLevel;
		const extras = byLevel.flatMap((requirement) => requirement.extraCandidateUuids);
		const candidateUuids = [
			...new Set([
				...collectOptionPoolCandidates(index, [classIdentifier, ...poolGroups], poolGroups),
				...extras,
			]),
		];
		const repeatable = new Set(byLevel.flatMap((requirement) => requirement.repeatableUuids));

		entitlements.push({
			poolKey: buildOptionPoolKey(poolGroups),
			poolGroups,
			displayName:
				joinDistinct(byLevel.map((requirement) => requirement.displayName)) ??
				poolGroups.map(formatGroupName).join(' / '),
			optionLabel: first.optionLabel,
			levels: [...new Set(byLevel.map((requirement) => requirement.level))].sort((a, b) => a - b),
			grantedCount: byLevel.reduce((total, requirement) => total + requirement.requiredCount, 0),
			slots: byLevel.map((requirement) => ({
				level: requirement.level,
				groups: [...requirement.slotGroups].sort(),
				count: requirement.requiredCount,
				optionLabel: requirement.optionLabel,
			})),
			candidateUuids,
			repeatableUuids: candidateUuids.filter((uuid) => repeatable.has(uuid)),
		});
	}

	return entitlements.sort(
		(a, b) => a.levels[0] - b.levels[0] || a.poolKey.localeCompare(b.poolKey),
	);
}

/** The pool's groups in the order the levels first name them, so a heading follows the class. */
function orderByFirstLevel(
	groups: ReadonlySet<string>,
	byLevel: ReadonlyArray<NarrowedRequirement>,
): string[] {
	const ordered: string[] = [];
	for (const requirement of byLevel) {
		for (const group of requirement.slotGroups) {
			if (groups.has(group) && !ordered.includes(group)) ordered.push(group);
		}
	}
	return ordered;
}

/** A requirement narrowed to the groups a caller allows, with the groups its level named kept. */
interface NarrowedRequirement extends OptionPoolRequirement {
	slotGroups: string[];
}

interface OptionPoolBucket {
	groups: Set<string>;
	requirements: NarrowedRequirement[];
}

/** Adds a requirement to the bucket sharing a group with it, folding together any it bridges. */
function mergeIntoBuckets(buckets: OptionPoolBucket[], requirement: NarrowedRequirement): void {
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
