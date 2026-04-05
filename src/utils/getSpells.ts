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
	/** Class restrictions - empty array means available to all classes */
	classes: string[];
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
		classes?: string[];
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
			classes?: string[];
			properties?: { selected?: string[] };
		};
		if (!system.school) continue;

		const selectedProperties = system.properties?.selected ?? [];

		// Skip secret spells - they should never be granted during character creation
		if (selectedProperties.includes('secretSpell')) continue;

		const isUtility = selectedProperties.includes('utilitySpell');

		addToIndex({
			uuid: item.uuid,
			name: item.name ?? 'Unknown Spell',
			img: item.img ?? 'icons/svg/item-bag.svg',
			school: system.school,
			tier: system.tier ?? 0,
			isUtility,
			classes: system.classes ?? [],
		});
	}

	// Process compendium packs
	const indexFields = [
		'system.school',
		'system.tier',
		'system.classes',
		'system.properties.selected',
	] as string[];

	for (const pack of game.packs) {
		if (pack.documentName !== 'Item') continue;

		// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as SpellPackIndexEntry;
			if (packEntry.type !== 'spell') continue;

			const system = packEntry.system;
			if (!system?.school) continue;

			const selectedProperties = system.properties?.selected ?? [];

			// Skip secret spells - they should never be granted during character creation
			if (selectedProperties.includes('secretSpell')) continue;

			const isUtility = selectedProperties.includes('utilitySpell');

			addToIndex({
				uuid: packEntry.uuid,
				name: packEntry.name ?? 'Unknown Spell',
				img: packEntry.img ?? 'icons/svg/item-bag.svg',
				school: system.school,
				tier: system.tier ?? 0,
				isUtility,
				classes: system.classes ?? [],
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
