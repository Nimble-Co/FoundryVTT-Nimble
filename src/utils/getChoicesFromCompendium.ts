export default function getChoicesFromCompendium(documentType: string): string[] {
	const documentIDs: string[] = [];

	for (const pack of game.packs) {
		for (const document of pack.index) {
			if (document.type !== documentType) continue;

			documentIDs.push(document.uuid);
		}
	}

	return documentIDs;
}
