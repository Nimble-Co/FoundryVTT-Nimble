/**
 * Get all available subclass choices filtered by parent class
 * @param parentClassIdentifier The identifier of the parent class to filter by
 * @returns Array of subclass objects with uuid, name, img, and system.parentClass
 */
export default async function getSubclassChoices(
	parentClassIdentifier: string,
): Promise<Array<{ uuid: string; name: string; img: string; system: { parentClass: string } }>> {
	const subclasses: Array<{
		uuid: string;
		name: string;
		img: string;
		system: { parentClass: string };
	}> = [];

	// Get subclasses from world items
	for (const item of game.items) {
		if (item.type !== 'subclass') continue;

		const subclass = item as object as NimbleSubclassItem;
		if (subclass.system.parentClass !== parentClassIdentifier) continue;

		subclasses.push({
			uuid: item.uuid,
			name: item.name,
			img: item.img as string,
			system: {
				parentClass: subclass.system.parentClass,
			},
		});
	}

	// Get subclasses from compendiums
	for (const pack of game.packs) {
		// Get the pack index
		const index = pack.index;

		for (const indexEntry of index) {
			const entry = indexEntry as object as {
				type?: string;
				uuid: string;
				name: string;
				img?: string;
				_id: string;
			};
			if (entry.type !== 'subclass') continue;

			// We need to load the full document to check parentClass
			// since it's not in the index by default
			try {
				const document = (await pack.getDocument(entry._id)) as object as NimbleSubclassItem | null;
				if (!document) continue;
				if (document.system.parentClass !== parentClassIdentifier) continue;

				subclasses.push({
					uuid: entry.uuid,
					name: entry.name,
					img: entry.img ?? 'icons/svg/item-bag.svg',
					system: {
						parentClass: document.system.parentClass,
					},
				});
			} catch (err) {
				console.warn(`Nimble | Failed to load subclass ${entry.uuid}:`, err);
			}
		}
	}

	// Sort by name
	return subclasses.sort((a, b) => a.name.localeCompare(b.name));
}
