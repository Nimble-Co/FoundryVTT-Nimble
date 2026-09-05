import getClassFeaturesFromIndex, { type ClassFeatureIndex } from '#utils/getClassFeatures.ts';
import isLevelUpOptionApplicable from '#utils/isLevelUpOptionApplicable.ts';

/** One level's demand on one pool. */
export interface PoolRequirement {
	level: number;
	poolGroups: string[];
	requiredCount: number;
	displayName: string | null;
	optionLabel: string | null;
}

/** Order-independent identity for a pool, so the same groups always resolve to one bucket. */
export function buildPoolKey(groups: readonly string[]): string {
	return [...groups].sort().join('+');
}

/**
 * What each level from 1 to `classLevel` asks the character to pick from a feature pool.
 *
 * A level-up option whose applicable set holds more than one alternative is skipped: the
 * player's choice between alternatives is never stored, so which pool (if any) that level
 * demanded picks from cannot be recovered. Reporting it would mean warning about a character
 * that is fine.
 */
export default async function collectPoolRequirements(
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
