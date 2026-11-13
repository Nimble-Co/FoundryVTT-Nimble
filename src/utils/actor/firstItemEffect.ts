interface ItemEffectLike {
	transfer?: boolean;
}

/** The effect an item gives: its first effect that is not applied to its owner (`transfer: false`). */
export function firstItemEffect<E extends ItemEffectLike>(
	item: { effects?: Iterable<E> | null } | null | undefined,
): E | null {
	for (const effect of item?.effects ?? []) if (effect.transfer === false) return effect;
	return null;
}
