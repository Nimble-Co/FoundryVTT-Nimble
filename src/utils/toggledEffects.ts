import { SYSTEM_ID } from '#system';

/**
 * Relational "marked target" tracking — used by the `markTarget` rule to record which
 * creatures an actor has marked (e.g. a Hunter's quarry). Storage is a flag on the
 * *marking* actor, keyed by an arbitrary `flagKey` so a single actor can maintain
 * several independent marked-target lists. The relationship is intentionally one-way:
 * only the actor that placed the mark sees the corresponding `target:<flagKey>` tag
 * when attacking, so multiple Hunters in a party don't share each other's quarry.
 *
 * Marks have no time-based expiry: "until you mark another creature" is modelled by
 * capacity eviction, and any figurative in-game duration ("for 1 day") is left to the
 * GM rather than tracked against worldTime — five real minutes can be days in-game.
 */

const FLAG_KEY = 'toggledEffects';

interface ToggledTargetEntry {
	/** UUID of the marked target's actor (synthetic for unlinked tokens). */
	actorUuid: string;
	/** UUID of the marked target's token document, when marked from a token. */
	tokenUuid: string | null;
	/** Display name captured at mark time, for chat/UI. */
	name: string;
}

type ToggledEffectsFlag = Record<string, ToggledTargetEntry[]>;

interface FlaggedActor {
	getFlag(scope: string, key: string): unknown;
}

/** Returns the actor's full marked-targets flag, defaulting to an empty record. */
function readToggledEffects(actor: FlaggedActor): ToggledEffectsFlag {
	const raw = actor.getFlag(SYSTEM_ID, FLAG_KEY) as ToggledEffectsFlag | undefined;
	if (!raw || typeof raw !== 'object') return {};
	return raw;
}

/**
 * Computes the next entry list after marking `newEntry`. Removes any existing entry for
 * the same target (re-marking refreshes it), then enforces `maxTargets` by evicting the
 * oldest. A `maxTargets <= 0` means unlimited.
 *
 * Returns the new list plus the entries that were evicted (so callers can clear each
 * evicted target's visible status condition).
 */
function computeNextToggledList(
	current: ToggledTargetEntry[],
	newEntry: ToggledTargetEntry,
	maxTargets: number,
): { list: ToggledTargetEntry[]; evicted: ToggledTargetEntry[] } {
	const evicted: ToggledTargetEntry[] = [];

	// Drop any prior mark on the same target (re-marking refreshes it).
	const retained = current.filter((entry) => entry.actorUuid !== newEntry.actorUuid);

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
 * A tag is emitted for every flag list in which the target currently has an entry. These
 * are injected into the target domain at activation time so relational predicates like
 * `target:quarry` resolve only for the marking actor.
 */
function getToggledTargetTags(
	attacker: FlaggedActor | null | undefined,
	targetActor: { uuid?: string } | null | undefined,
): Set<string> {
	const tags = new Set<string>();
	if (!attacker || !targetActor?.uuid) return tags;

	const flag = readToggledEffects(attacker);
	for (const [flagKey, entries] of Object.entries(flag)) {
		if (!Array.isArray(entries)) continue;
		const matched = entries.some((entry) => entry.actorUuid === targetActor.uuid);
		if (matched) tags.add(`target:${flagKey}`);
	}

	return tags;
}

export {
	FLAG_KEY as TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
	type ToggledEffectsFlag,
	readToggledEffects,
	computeNextToggledList,
	getToggledTargetTags,
};
