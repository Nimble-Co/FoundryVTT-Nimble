import type { SpellIndex, SpellIndexEntry } from '#utils/getSpells.js';

/**
 * Options for filtering spells from the index.
 */
export interface GetSpellsOptions {
	/**
	 * Filter by utility spell status:
	 * - true: Only return utility spells
	 * - false (default): Only return non-utility spells (cantrips/combat spells)
	 */
	utilityOnly?: boolean;
	/** Filter spells by class - only includes spells available to this class */
	forClass?: string;
}

/**
 * Gets spells from a pre-built index matching the given schools and tiers.
 */
export function getSpellsFromIndex(
	index: SpellIndex,
	schools: string[],
	tiers: number[],
	options: GetSpellsOptions = {},
): SpellIndexEntry[] {
	const { utilityOnly = false, forClass } = options;
	const results: SpellIndexEntry[] = [];

	for (const school of schools) {
		const tierMap = index.get(school);
		if (!tierMap) continue;

		for (const tier of tiers) {
			const spells = tierMap.get(tier);
			if (spells) {
				for (const spell of spells) {
					// Filter by utility status - mutually exclusive categories
					if (utilityOnly && !spell.isUtility) continue;
					if (!utilityOnly && spell.isUtility) continue;

					// Filter by class restriction - if spell has class restrictions,
					// only include it if the requesting class is in the list
					if (forClass && spell.classes.length > 0 && !spell.classes.includes(forClass)) {
						continue;
					}

					results.push(spell);
				}
			}
		}
	}

	// Sort by name for consistent display
	results.sort((a, b) => a.name.localeCompare(b.name));

	return results;
}
