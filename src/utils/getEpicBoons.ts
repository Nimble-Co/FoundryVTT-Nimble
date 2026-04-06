import type { NimbleBoonItem } from '#documents/item/boon.js';

interface EpicBoonChoice {
	uuid: string;
	name: string;
	img: string;
	system: { boonType: string; description: string };
}

/**
 * Get all available epic boons from world items and compendiums
 * @returns Array of epic boon objects with uuid, name, img, and system data
 */
export default async function getEpicBoons(): Promise<EpicBoonChoice[]> {
	const epicBoons: EpicBoonChoice[] = [];

	// Get epic boons from world items
	for (const item of game.items) {
		if (item.type !== 'boon') continue;

		const boon = item as object as NimbleBoonItem;
		if (boon.system.boonType !== 'epic') continue;

		epicBoons.push({
			uuid: item.uuid,
			name: item.name,
			img: item.img as string,
			system: {
				boonType: boon.system.boonType,
				description: boon.system.description,
			},
		});
	}

	// Get epic boons from compendiums
	for (const pack of game.packs) {
		const index = pack.index;

		for (const indexEntry of index) {
			const entry = indexEntry as object as {
				type?: string;
				uuid: string;
				name: string;
				img?: string;
				_id: string;
			};
			if (entry.type !== 'boon') continue;

			// Load the full document to check boonType
			try {
				const document = (await pack.getDocument(entry._id)) as object as NimbleBoonItem | null;
				if (!document) continue;
				if (document.system.boonType !== 'epic') continue;

				epicBoons.push({
					uuid: entry.uuid,
					name: entry.name,
					img: entry.img ?? 'icons/svg/item-bag.svg',
					system: {
						boonType: document.system.boonType,
						description: document.system.description,
					},
				});
			} catch (err) {
				console.warn(`Nimble | Failed to load boon ${entry.uuid}:`, err);
			}
		}
	}

	// Sort by name
	return epicBoons.sort((a, b) => a.name.localeCompare(b.name));
}
