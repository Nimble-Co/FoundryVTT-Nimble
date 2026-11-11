interface OriginEffect {
	id?: string | null;
	origin?: string | null;
}

interface EffectHolder {
	effects?: Iterable<OriginEffect>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

interface DeletedItem {
	uuid?: string | null;
	parent?: unknown;
}

/**
 * Deletes the effects on the item's actor that the item gave, so none stays with no source. The
 * item's own effects go with it; effects on other actors stay.
 */
export async function deleteOriginEffects(item: DeletedItem): Promise<void> {
	if (!item.uuid || !(item.parent instanceof Actor)) return;
	const actor = item.parent as unknown as EffectHolder;
	const ids = [...(actor.effects ?? [])].flatMap((effect) =>
		effect.origin === item.uuid && effect.id ? [effect.id] : [],
	);
	if (ids.length < 1) return;
	await actor.deleteEmbeddedDocuments('ActiveEffect', ids);
}

let registered = false;

/** Runs on the client of the user who deleted the item. */
export default function registerDeleteItemOriginEffectsHooks(): void {
	if (registered) return;
	registered = true;
	Hooks.on('deleteItem', (item, _options, userId) => {
		if (userId !== game.user?.id) return;
		void deleteOriginEffects(item as unknown as DeletedItem).catch((error) =>
			console.error('Nimble | Could not delete the effects of a deleted item.', error),
		);
	});
}
