export default function getChoicesFromCompendium(documentType: string): string[] {
	const documentIDs = new Set<string>();

	// Get items from world items. When a world item was imported from a compendium,
	// use the compendium source UUID so character creation always reads up-to-date
	// rules rather than a potentially stale local copy.
	for (const item of game.items) {
		if (item.type !== documentType) continue;
		const itemData = item as object as {
			_stats?: { compendiumSource?: string };
			flags?: { core?: { sourceId?: string } };
		};
		const compendiumSource = itemData._stats?.compendiumSource ?? itemData.flags?.core?.sourceId;
		documentIDs.add(compendiumSource ?? item.uuid);
	}

	// Get items from compendium packs (no-op if already added via world item source)
	for (const pack of game.packs) {
		for (const document of pack.index) {
			if ((document as object as { type?: string }).type !== documentType) continue;
			documentIDs.add(document.uuid);
		}
	}

	return [...documentIDs];
}
