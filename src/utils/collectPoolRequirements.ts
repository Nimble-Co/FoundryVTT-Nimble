import getClassFeaturesFromIndex, { type ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

/** One level's demand on one pool. */
export interface PoolRequirement {
	level: number;
	poolGroups: string[];
	/** Items an alternative at this level grants outright, offered alongside the groups' members. */
	extraCandidateUuids: string[];
	requiredCount: number;
	displayName: string | null;
	optionLabel: string | null;
}

export interface CollectPoolRequirementsOptions {
	/**
	 * What to do with a level whose feature offers a choice between several options.
	 * `skip`, the default, leaves the level out: which option was taken is never recorded, so
	 * the level cannot be said to owe anything. `union` folds every alternative into one
	 * requirement, for a caller that wants everything the level could have bought.
	 */
	alternatives?: 'skip' | 'union';
}

/** The uuids an option's rules grant outright. */
function grantedUuids(rules: ReadonlyArray<Record<string, unknown>>): string[] {
	return rules
		.filter((rule) => rule.type === 'grantItem' && typeof rule.uuid === 'string' && rule.uuid)
		.map((rule) => rule.uuid as string);
}

/** Order-independent identity for a pool, so the same groups always resolve to one bucket. */
export function buildPoolKey(groups: readonly string[]): string {
	return [...groups].sort().join('+');
}

/**
 * What each level from 1 to `classLevel` asks the character to pick from a feature pool.
 *
 * A level-up option whose applicable set holds more than one alternative is skipped by
 * default: the player's choice between alternatives is never stored, so which pool (if any)
 * that level demanded picks from cannot be recovered. Reporting it would mean warning about a
 * character that is fine. See {@link CollectPoolRequirementsOptions} for the other reading.
 */
export default async function collectPoolRequirements(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	{ alternatives = 'skip' }: CollectPoolRequirementsOptions = {},
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
				extraCandidateUuids: [],
				requiredCount: group.selectionCount,
				displayName: group.displayName ?? null,
				optionLabel: null,
			});
		}

		for (const feature of offered.optionFeatures) {
			const applicable = (feature.system.levelUpOptions ?? []).filter((option) =>
				isLevelUpOptionApplicable(option, level),
			);
			if (applicable.length === 0) continue;
			if (applicable.length > 1 && alternatives === 'skip') continue;

			const poolGroups = [...new Set(applicable.flatMap((option) => option.selectionGroups ?? []))];
			// Alternatives that only grant items have nothing to draw a pool from.
			if (poolGroups.length === 0) continue;

			const [option] = applicable;
			const isSingle = applicable.length === 1;

			requirements.push({
				level,
				poolGroups,
				extraCandidateUuids: applicable.flatMap((candidate) => grantedUuids(candidate.rules ?? [])),
				// Compendium options may leave the count unset, meaning a single pick. A choice
				// between alternatives is one pick whichever way it went.
				requiredCount: isSingle ? (option.selectionCount ?? 1) : 1,
				displayName: feature.name ?? null,
				optionLabel: isSingle ? option.label || null : null,
			});
		}
	}

	return requirements;
}
