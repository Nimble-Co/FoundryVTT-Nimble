import getClassFeaturesFromIndex, { type ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

/** One level's demand on one option pool: a set of feature groups a class asks a pick from. */
export interface OptionPoolRequirement {
	level: number;
	poolGroups: string[];
	/** Items an alternative at this level grants outright, offered alongside the groups' members. */
	extraCandidateUuids: string[];
	/** The subset of `extraCandidateUuids` whose grant rule allows a duplicate, so a pick may repeat. */
	repeatableUuids: string[];
	requiredCount: number;
	displayName: string | null;
	optionLabel: string | null;
}

export interface CollectOptionPoolRequirementsOptions {
	/**
	 * What to do with a level whose feature offers a choice between several options.
	 * `skip`, the default, leaves the level out: which option was taken is never recorded, so
	 * the level cannot be said to owe anything. `union` folds every alternative into one
	 * requirement, for a caller that wants everything the level could have bought.
	 */
	alternatives?: 'skip' | 'union';
}

/** The grant rules among an option's rules. */
function grantRules(rules: ReadonlyArray<Record<string, unknown>>): Record<string, unknown>[] {
	return rules.filter(
		(rule) => rule.type === 'grantItem' && typeof rule.uuid === 'string' && rule.uuid,
	);
}

/** The uuids an option's rules grant outright. */
function grantedUuids(rules: ReadonlyArray<Record<string, unknown>>): string[] {
	return grantRules(rules).map((rule) => rule.uuid as string);
}

/**
 * The uuids an option's rules grant with duplicates allowed. The rules on a level-up option
 * are raw objects, so no schema default reaches them: an unauthored flag reads as off.
 */
function repeatableUuids(rules: ReadonlyArray<Record<string, unknown>>): string[] {
	return grantRules(rules)
		.filter((rule) => rule.allowDuplicate === true)
		.map((rule) => rule.uuid as string);
}

/** Order-independent identity for an option pool, so the same groups always resolve to one bucket. */
export function buildOptionPoolKey(groups: readonly string[]): string {
	return [...groups].sort().join('+');
}

/**
 * What each level from 1 to `classLevel` asks the character to pick from an option pool.
 *
 * A level-up option whose applicable set holds more than one alternative is skipped by
 * default: the player's choice between alternatives is never stored, so which pool (if any)
 * that level demanded picks from cannot be recovered. Reporting it would mean warning about a
 * character that is fine. See {@link CollectOptionPoolRequirementsOptions} for the other reading.
 */
export default async function collectOptionPoolRequirements(
	index: ClassFeatureIndex,
	classIdentifier: string,
	classLevel: number,
	{ alternatives = 'skip' }: CollectOptionPoolRequirementsOptions = {},
): Promise<OptionPoolRequirement[]> {
	const requirements: OptionPoolRequirement[] = [];

	for (let level = 1; level <= classLevel; level++) {
		// An empty owned set asks the resolver what the level demands, independent of what the
		// character has — the comparison against owned features happens below.
		const offered = await getClassFeaturesFromIndex(index, classIdentifier, level, {});

		for (const [groupName, group] of offered.selectionGroups) {
			requirements.push({
				level,
				poolGroups: [groupName],
				extraCandidateUuids: [],
				repeatableUuids: [],
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
				repeatableUuids: applicable.flatMap((candidate) => repeatableUuids(candidate.rules ?? [])),
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
