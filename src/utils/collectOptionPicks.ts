/** The part of a level-up history entry the picks are read from. */
export interface OptionPickHistoryEntry {
	level: number;
	grantedFeatureIds: readonly string[];
}

/**
 * The picks a character's level-up history records, per compendium source.
 *
 * A pick is an embedded item whose id a history entry names as granted. The history stores
 * ids only, so `sourceOf` reads the compendium source off the live item; an id whose item is
 * gone, or has no source, is dropped. An item on the sheet that no entry names is not a pick,
 * and there is no fallback that counts it.
 *
 * Each source maps to its pick ids oldest granting level first, so a caller that releases
 * picks from the front keeps the most recent one.
 */
export default function collectOptionPicks(
	history: readonly OptionPickHistoryEntry[],
	sourceOf: (itemId: string) => string | null | undefined,
): Map<string, string[]> {
	const picks = new Map<string, string[]>();
	const seen = new Set<string>();

	const byLevel = [...history].sort((a, b) => a.level - b.level);
	for (const entry of byLevel) {
		for (const itemId of entry.grantedFeatureIds) {
			if (seen.has(itemId)) continue;
			seen.add(itemId);

			const source = sourceOf(itemId);
			if (!source) continue;

			const ids = picks.get(source);
			if (ids) ids.push(itemId);
			else picks.set(source, [itemId]);
		}
	}

	return picks;
}
