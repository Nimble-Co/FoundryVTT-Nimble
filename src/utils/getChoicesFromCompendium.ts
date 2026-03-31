export default function getChoicesFromCompendium(documentType: string): string[] {
	const documentIDs: string[] = [];

	// Get items from world items
	for (const item of game.items) {
		if (item.type !== documentType) continue;
		documentIDs.push(item.uuid);
	}

	// Get items from compendium packs
	for (const pack of game.packs) {
		for (const document of pack.index) {
			if ((document as object as { type?: string }).type !== documentType) continue;

			documentIDs.push(document.uuid);
		}
	}

	return documentIDs;
}
