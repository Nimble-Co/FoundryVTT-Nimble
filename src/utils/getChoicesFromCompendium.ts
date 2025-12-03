export default function getChoicesFromCompendium(documentType: string): string[] {
	const documentIDs: string[] = [];

	for (const pack of game.packs) {
		for (const document of pack.index) {
			const docWithType = document as { type?: string; uuid: string };
			if (docWithType.type !== documentType) continue;

			documentIDs.push(document.uuid);
		}
	}

	return documentIDs;
}
