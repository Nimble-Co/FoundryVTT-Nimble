type TierLike = { type?: string | null; system?: { tier?: number } | null };

/** A spell of tier 1 or more. A cantrip is tier 0. */
export function isTieredSpell<T extends TierLike>(item: T | null | undefined): item is T {
	return item?.type === 'spell' && Number(item.system?.tier ?? 0) >= 1;
}
