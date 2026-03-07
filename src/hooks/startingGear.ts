const STARTING_GEAR_PACK_ID = 'nimble.nimble-items';

const STARTING_GEAR_ITEMS: Array<{ id: string; name: string; qty: number }> = [
	{ id: 'MNFxluopbBHRBybK', name: 'Torch (Stack of 2)', qty: 1 },
	{ id: 'DBeqkbYmH1xEvdDA', name: 'Blanket', qty: 1 },
	{ id: '7ZPoo93Dm8dVHO99', name: 'Healing Potion', qty: 2 },
	{ id: 'Zn4ohFLqqKP1W52v', name: 'Pitons', qty: 1 },
];

export default function registerStartingGearHook(): void {
	Hooks.on('createActor', async (actorDoc: unknown, _options: unknown, userId: unknown) => {
		const actor = actorDoc as Actor;
		if (actor.type !== 'character') return;
		if (game.user.id !== (userId as string)) return;

		const pack = game.packs.get(STARTING_GEAR_PACK_ID);
		if (!pack) {
			console.warn('Nimble | Starting gear: pack not found -', STARTING_GEAR_PACK_ID);
			return;
		}

		try {
			const toCreate: Record<string, unknown>[] = [];
			for (const entry of STARTING_GEAR_ITEMS) {
				const doc = await pack.getDocument(entry.id);
				if (!doc) {
					console.warn('Nimble | Starting gear: item not found -', entry.name);
					continue;
				}
				const data = (doc as Item).toObject() as Record<string, unknown>;
				const system = data.system as Record<string, unknown> | undefined;
				if (entry.qty > 1 && system?.quantity !== undefined) {
					system.quantity = entry.qty;
				}
				toCreate.push(data);
			}

			if (toCreate.length) {
				await actor.createEmbeddedDocuments('Item', toCreate as never[]);
				ui.notifications?.info(`Nimble | Added starting equipment to ${actor.name}.`);
			}
		} catch (err) {
			console.error('Nimble | Starting gear hook error:', err);
		}
	});
}
