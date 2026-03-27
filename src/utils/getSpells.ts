/**
 * Utilities for building and querying a spell index.
 * Used during character creation to quickly find spells by school and tier.
 */

/**
 * Lightweight entry stored in the spell index.
 * Contains only the data needed for display and granting.
 */
export interface SpellIndexEntry {
	uuid: string;
	name: string;
	img: string;
	school: string;
	tier: number;
	isUtility: boolean;
}

/**
 * Index structure for fast spell lookups.
 * Maps school → tier → array of spell entries.
 */
export type SpellIndex = Map<string, Map<number, SpellIndexEntry[]>>;

/**
 * Shape of a spell's indexed fields in a compendium pack.
 */
interface SpellPackIndexEntry {
	_id: string;
	uuid: string;
	type: string;
	name: string;
	img: string;
	system?: {
		school?: string;
		tier?: number;
		properties?: {
			selected?: string[];
		};
	};
}

/**
 * Builds a spell index by scanning all spell packs once.
 * Call this when opening the character creator, then use getSpellsFromIndex
 * for instant lookups.
 */
export async function buildSpellIndex(): Promise<SpellIndex> {
	const index: SpellIndex = new Map();

	// Track seen UUIDs to avoid duplicates
	const seen = new Set<string>();

	/**
	 * Adds a spell entry to the index for a specific school and tier.
	 */
	function addToIndex(entry: SpellIndexEntry): boolean {
		if (seen.has(entry.uuid)) {
			return false; // Already added
		}
		seen.add(entry.uuid);

		const { school, tier } = entry;

		if (!index.has(school)) {
			index.set(school, new Map());
		}
		const tierMap = index.get(school)!;
		if (!tierMap.has(tier)) {
			tierMap.set(tier, []);
		}
		tierMap.get(tier)!.push(entry);
		return true;
	}

	// Process world items (spells in the game world)
	for (const item of game.items) {
		if (item.type !== 'spell') continue;

		const system = item.system as {
			school?: string;
			tier?: number;
			properties?: { selected?: string[] };
		};
		if (!system.school) continue;

		const isUtility = system.properties?.selected?.includes('utilitySpell') ?? false;

		addToIndex({
			uuid: item.uuid,
			name: item.name ?? 'Unknown Spell',
			img: item.img ?? 'icons/svg/item-bag.svg',
			school: system.school,
			tier: system.tier ?? 0,
			isUtility,
		});
	}

	// Process compendium packs
	const indexFields = ['system.school', 'system.tier', 'system.properties.selected'] as string[];

	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;

		// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as SpellPackIndexEntry;
			if (packEntry.type !== 'spell') continue;

			const system = packEntry.system;
			if (!system?.school) continue;

			const isUtility = system.properties?.selected?.includes('utilitySpell') ?? false;

			addToIndex({
				uuid: packEntry.uuid,
				name: packEntry.name ?? 'Unknown Spell',
				img: packEntry.img ?? 'icons/svg/item-bag.svg',
				school: system.school,
				tier: system.tier ?? 0,
				isUtility,
			});
		}
	}

	// Sort spells within each school/tier by name
	for (const tierMap of index.values()) {
		for (const spells of tierMap.values()) {
			spells.sort((a, b) => a.name.localeCompare(b.name));
		}
	}

	return index;
}

/**
 * Options for filtering spells from the index.
 */
export interface GetSpellsOptions {
	/** Whether to include utility spells (default: true) */
	includeUtility?: boolean;
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
	const { includeUtility = true } = options;
	const results: SpellIndexEntry[] = [];

	for (const school of schools) {
		const tierMap = index.get(school);
		if (!tierMap) continue;

		for (const tier of tiers) {
			const spells = tierMap.get(tier);
			if (spells) {
				for (const spell of spells) {
					// Filter out utility spells if not requested
					if (!includeUtility && spell.isUtility) continue;
					results.push(spell);
				}
			}
		}
	}

	// Sort by name for consistent display
	results.sort((a, b) => a.name.localeCompare(b.name));

	return results;
}

/**
 * Gets all available schools from the spell index.
 * Useful for displaying school selection options.
 */
export function getAvailableSchools(index: SpellIndex): string[] {
	return [...index.keys()].sort();
}

/**
 * Gets all spells of a specific tier from the index.
 * Useful for checking what cantrips (tier 0) exist in a school.
 */
export function getSpellsByTier(index: SpellIndex, tier: number): SpellIndexEntry[] {
	const results: SpellIndexEntry[] = [];

	for (const tierMap of index.values()) {
		const spells = tierMap.get(tier);
		if (spells) {
			results.push(...spells);
		}
	}

	results.sort((a, b) => a.name.localeCompare(b.name));

	return results;
}
