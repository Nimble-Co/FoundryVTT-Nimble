import type { Moment } from './momentReached.js';

interface StatusEntry {
	id: string;
	system?: { lastsUntil?: Moment[] };
}

/** The effect says that only removing it ends it, so no status gives it moments. */
export function untilRemoved(system: unknown): boolean {
	return (system as { untilRemoved?: boolean } | null | undefined)?.untilRemoved === true;
}

/** The Lasts Until of the first status that has one, as an effect with no moments of its own gets. */
export function statusLastsUntil(
	statuses: Iterable<string>,
): { status: string; moments: Moment[] } | null {
	const entries = (CONFIG as { statusEffects?: StatusEntry[] }).statusEffects ?? [];
	for (const status of statuses) {
		const moments = entries.find((entry) => entry.id === status)?.system?.lastsUntil;
		if (moments?.length) return { status, moments };
	}
	return null;
}

/** The moments an effect ends at once applied: its own, else a status's, unless "until removed". */
export function appliedLastsUntil(effect: {
	system?: unknown;
	statuses?: Iterable<string> | null;
}): Moment[] {
	const own = (effect.system as { lastsUntil?: Moment[] } | undefined)?.lastsUntil ?? [];
	if (own.length || untilRemoved(effect.system)) return own;
	return statusLastsUntil(effect.statuses ?? [])?.moments ?? [];
}
