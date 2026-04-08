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

		const boon = item as unknown as NimbleBoonItem;
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

	// Get epic boons from compendiums (batch-load all boons per pack)
	for (const pack of game.packs) {
		// Skip packs that have no boon-type entries in the index
		const hasBoons = [...pack.index].some(
			(entry) => (entry as unknown as { type?: string }).type === 'boon',
		);
		if (!hasBoons) continue;

		try {
			const documents = (await pack.getDocuments({
				type: 'boon',
			})) as unknown as NimbleBoonItem[];

			for (const boon of documents) {
				if (boon.system.boonType !== 'epic') continue;

				epicBoons.push({
					uuid: boon.uuid,
					name: boon.name,
					img: (boon.img as string) ?? 'icons/svg/item-bag.svg',
					system: {
						boonType: boon.system.boonType,
						description: boon.system.description,
					},
				});
			}
		} catch (err) {
			console.warn(`Nimble | Failed to load boons from pack ${pack.collection}:`, err);
		}
	}

	// Sort by name
	return epicBoons.sort((a, b) => a.name.localeCompare(b.name));
}
