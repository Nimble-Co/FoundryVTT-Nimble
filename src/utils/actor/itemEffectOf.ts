interface ItemEffectLike {
	transfer?: boolean;
}

interface ItemWithEffects<E extends ItemEffectLike> {
	effects?: { get(id: string): E | undefined | null } | null;
}

/**
 * The item's own effect with this id, when it is not applied to the actor that has the item
 * (`transfer: false`). Else null.
 */
export function itemEffectOf<E extends ItemEffectLike>(
	item: ItemWithEffects<E> | null | undefined,
	effectId: string | null | undefined,
): E | null {
	if (!item || !effectId) return null;
	const effect = item.effects?.get(effectId);
	if (!effect || effect.transfer !== false) return null;
	return effect;
}
