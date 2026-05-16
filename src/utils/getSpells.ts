/**
 * Utilities for building and querying a spell index.
 * Used during character creation to quickly find spells by school and tier.
 */

const DEFAULT_NIMBLE_SPELL_PACK = 'nimble.nimble-spells';

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
	/** Semantic slug identifier from system.identifier, or empty string if unset */
	identifier: string;
	/** Class restrictions - empty array means available to all classes */
	classes: string[];
}

/**
 * Produces a stable deduplication key for a spell using its identifier (or name
 * as fallback), tier, and school.  Two spells with the same key are treated as
 * the same spell regardless of which pack they come from.
 */
export function spellSignature(
	identifier: string,
	name: string,
	tier: number,
	school: string,
): string {
	const key = identifier.trim() || name.toLowerCase().trim();
	return `${key}:${tier}:${school}`;
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
		identifier?: string;
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

	// Track seen UUIDs to avoid duplicates.
	// Also track compendium source UUIDs covered by world items so we can skip
	// the original compendium entry when a world-item copy already exists.
	// Finally, track spell signatures (identifier+tier+school) so that copy packs
	// don't produce duplicate entries when the default Nimble pack is indexed first.
	const seen = new Set<string>();
	const seenCompendiumSources = new Set<string>();
	const seenSignatures = new Set<string>();

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
			identifier?: string;
			classes?: string[];
			properties?: { selected?: string[] };
		};
		if (!system.school) continue;

		const selectedProperties = system.properties?.selected ?? [];

		// Skip secret spells - they should never be granted during character creation
		if (selectedProperties.includes('secretSpell')) continue;

		const isUtility = selectedProperties.includes('utilitySpell');
		const identifier = system.identifier ?? '';
		const name = item.name ?? 'Unknown Spell';
		const tier = system.tier ?? 0;

		const added = addToIndex({
			uuid: item.uuid,
			name,
			img: item.img ?? 'icons/svg/item-bag.svg',
			school: system.school,
			tier,
			isUtility,
			identifier,
			classes: system.classes ?? [],
		});

		// If this world item was imported from a compendium, mark that source UUID as
		// covered so the compendium's own entry is skipped below (prevents duplicates
		// when a player has world-item copies of compendium spells).
		if (added) {
			seenSignatures.add(spellSignature(identifier, name, tier, system.school));
			const compendiumSource = (item._stats as { compendiumSource?: string } | undefined)
				?.compendiumSource;
			if (compendiumSource) seenCompendiumSources.add(compendiumSource);
		}
	}

	// Process compendium packs — default Nimble pack first so its entries win over
	// any copy packs a GM may have created with different UUIDs.
	const indexFields = [
		'system.school',
		'system.tier',
		'system.identifier',
		'system.classes',
		'system.properties.selected',
	] as string[];

	const sortedPacks = [...game.packs].sort((a, b) => {
		if (a.collection === DEFAULT_NIMBLE_SPELL_PACK) return -1;
		if (b.collection === DEFAULT_NIMBLE_SPELL_PACK) return 1;
		return 0;
	});

	for (const pack of sortedPacks) {
		if (pack.documentName !== 'Item') continue;

		// @ts-expect-error - Foundry types don't include custom index fields, but the API accepts them
		const packIndex = await pack.getIndex({ fields: indexFields });
		for (const indexEntry of packIndex) {
			const packEntry = indexEntry as SpellPackIndexEntry;
			if (packEntry.type !== 'spell') continue;

			// Skip if a world item imported from this compendium entry is already indexed
			if (seenCompendiumSources.has(packEntry.uuid)) continue;

			const system = packEntry.system;
			if (!system?.school) continue;

			const selectedProperties = system.properties?.selected ?? [];

			// Skip secret spells - they should never be granted during character creation
			if (selectedProperties.includes('secretSpell')) continue;

			const identifier = system.identifier ?? '';
			const name = packEntry.name ?? 'Unknown Spell';
			const tier = system.tier ?? 0;
			const sig = spellSignature(identifier, name, tier, system.school);

			// Skip if another pack (or a world item) already contributed a spell with this
			// identifier+tier+school combination.  Processing the default Nimble pack first
			// guarantees its entries take priority over any copy packs.
			if (seenSignatures.has(sig)) continue;

			const isUtility = selectedProperties.includes('utilitySpell');

			const added = addToIndex({
				uuid: packEntry.uuid,
				name,
				img: packEntry.img ?? 'icons/svg/item-bag.svg',
				school: system.school,
				tier,
				isUtility,
				identifier,
				classes: system.classes ?? [],
			});
			if (added) seenSignatures.add(sig);
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
