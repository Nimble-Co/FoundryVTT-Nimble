/**
 * The uuids of the items whose use gave the actor an active effect: enabled and not suppressed.
 * Only effects on the actor count: an item's passive effects stay on the item.
 */
export function activeOrigins(
	effects: Iterable<{ origin?: string | null; active?: boolean }> | null | undefined,
): Set<string> {
	const origins = new Set<string>();
	for (const effect of effects ?? []) {
		if (effect.active && effect.origin) origins.add(effect.origin);
	}
	return origins;
}
