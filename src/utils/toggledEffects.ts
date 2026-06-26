import { SYSTEM_ID } from '#system';

/**
 * Relational "toggled effect" tracking — used by the `toggleEffect` rule to record
 * which creatures an actor has marked (e.g. a Hunter's quarry). Storage is a flag on
 * the *marking* actor, keyed by an arbitrary `flagKey` so a single actor can maintain
 * several independent toggled-target lists. The relationship is intentionally one-way:
 * only the actor that placed the mark sees the corresponding `target:<flagKey>` tag
 * when attacking, so multiple Hunters in a party don't share each other's quarry.
 */

const FLAG_KEY = 'toggledEffects';
const SECONDS_PER_DAY = 86400;

interface ToggledTargetEntry {
	/** UUID of the marked target's actor (synthetic for unlinked tokens). */
	actorUuid: string;
	/** UUID of the marked target's token document, when marked from a token. */
	tokenUuid: string | null;
	/** Display name captured at mark time, for chat/UI. */
	name: string;
	/** World time (seconds) the mark was placed, for duration expiry. */
	markedAt: number;
	/** Days the mark lasts; null means it persists until replaced or cleared. */
	durationDays: number | null;
}

type ToggledEffectsFlag = Record<string, ToggledTargetEntry[]>;

interface FlaggedActor {
	getFlag(scope: string, key: string): unknown;
}

/** Current world time in seconds, falling back to 0 when the clock is unavailable. */
function getCurrentWorldTime(): number {
	const time = (globalThis as { game?: { time?: { worldTime?: number } } }).game?.time?.worldTime;
	return typeof time === 'number' ? time : 0;
}

/** Returns the actor's full toggled-effects flag, defaulting to an empty record. */
function readToggledEffects(actor: FlaggedActor): ToggledEffectsFlag {
	const raw = actor.getFlag(SYSTEM_ID, FLAG_KEY) as ToggledEffectsFlag | undefined;
	if (!raw || typeof raw !== 'object') return {};
	return raw;
}

/** True when a duration-bounded entry has aged past its window. */
function isEntryExpired(entry: ToggledTargetEntry, now: number = getCurrentWorldTime()): boolean {
	if (entry.durationDays === null) return false;
	return now - entry.markedAt >= entry.durationDays * SECONDS_PER_DAY;
}

/**
 * Computes the next entry list after marking `newEntry`. Removes any existing entry
 * for the same target (re-marking refreshes it) and any expired entries, then enforces
 * `maxTargets` by evicting the oldest. A `maxTargets <= 0` means unlimited.
 *
 * Returns the new list plus the entries that were evicted (so callers can clean up
 * each evicted target's visible status condition).
 */
function computeNextToggledList(
	current: ToggledTargetEntry[],
	newEntry: ToggledTargetEntry,
	maxTargets: number,
	now: number = getCurrentWorldTime(),
): { list: ToggledTargetEntry[]; evicted: ToggledTargetEntry[] } {
	const evicted: ToggledTargetEntry[] = [];

	// Drop expired entries and any prior mark on the same target.
	const retained = current.filter((entry) => {
		if (entry.actorUuid === newEntry.actorUuid) return false;
		if (isEntryExpired(entry, now)) {
			evicted.push(entry);
			return false;
		}
		return true;
	});

	retained.push(newEntry);

	// Enforce capacity (oldest first) when bounded.
	if (maxTargets > 0) {
		while (retained.length > maxTargets) {
			const removed = retained.shift();
			if (removed) evicted.push(removed);
		}
	}

	return { list: retained, evicted };
}

/**
 * Returns the `target:<flagKey>` tags that apply when `attacker` attacks `targetActor`.
 * A tag is emitted for every flag list in which the target has a live (non-expired)
 * entry. These are injected into the target domain at activation time so relational
 * predicates like `target:quarry` resolve only for the marking actor.
 */
function getToggledTargetTags(
	attacker: FlaggedActor | null | undefined,
	targetActor: { uuid?: string } | null | undefined,
	now: number = getCurrentWorldTime(),
): Set<string> {
	const tags = new Set<string>();
	if (!attacker || !targetActor?.uuid) return tags;

	const flag = readToggledEffects(attacker);
	for (const [flagKey, entries] of Object.entries(flag)) {
		if (!Array.isArray(entries)) continue;
		const matched = entries.some(
			(entry) => entry.actorUuid === targetActor.uuid && !isEntryExpired(entry, now),
		);
		if (matched) tags.add(`target:${flagKey}`);
	}

	return tags;
}

export {
	FLAG_KEY as TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
	type ToggledEffectsFlag,
	getCurrentWorldTime,
	readToggledEffects,
	isEntryExpired,
	computeNextToggledList,
	getToggledTargetTags,
};
