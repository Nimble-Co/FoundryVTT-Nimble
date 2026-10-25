/**
 * Canonical property paths for actor HP / wound fields that `updateActor` hook
 * handlers need to watch. Centralizing these keeps listeners consistent when
 * the system data shape changes.
 */
export const ACTOR_HP_PATHS = {
	value: 'system.attributes.hp.value',
	max: 'system.attributes.hp.max',
} as const;

export const ACTOR_WOUNDS_PATHS = {
	value: 'system.attributes.wounds.value',
	max: 'system.attributes.wounds.max',
} as const;

/**
 * Returns true if any of the provided dot-notation paths appears in the
 * `changes` diff emitted by Foundry's `updateActor` hook.
 */
export function hasAnyActorChangeAt(
	changes: Record<string, unknown>,
	paths: readonly string[],
): boolean {
	return paths.some((path) => foundry.utils.hasProperty(changes, path));
}

/**
 * What an actor's `_preUpdate` recorded before the update, read back from the
 * update options that reach `_onUpdate` and the `updateActor` hook on every client.
 */
export interface ActorUpdateBefore {
	previousHp?: { value: number; max: number; temp: number };
	previousWounds?: number;
}

function recordedBefore(options: unknown): ActorUpdateBefore {
	const nimble = (options as { nimble?: ActorUpdateBefore } | null | undefined)?.nimble; // allow-hardcoded-system-id
	return nimble ?? {};
}

function numberAt(actor: unknown, path: string): number {
	let cursor: unknown = actor;
	for (const key of path.split('.')) {
		if (cursor === null || typeof cursor !== 'object') return 0;
		cursor = (cursor as Record<string, unknown>)[key];
	}
	return typeof cursor === 'number' && Number.isFinite(cursor) ? cursor : 0;
}

/** The HP value before the update, or undefined when the update did not record it. */
export function hpBeforeUpdate(options: unknown): number | undefined {
	const before = recordedBefore(options).previousHp?.value;
	return typeof before === 'number' ? before : undefined;
}

/**
 * HP the update healed; 0 when it healed none or did not record the HP before it.
 * HP that only follows a higher max HP (a level up) is not healing.
 */
export function hpGained(actor: unknown, options: unknown): number {
	const before = recordedBefore(options).previousHp;
	if (typeof before?.value !== 'number') return 0;
	const valueRise = numberAt(actor, ACTOR_HP_PATHS.value) - before.value;
	const maxRise = Math.max(0, numberAt(actor, ACTOR_HP_PATHS.max) - (before.max ?? 0));
	return Math.max(0, valueRise - maxRise);
}

/** Wounds the update added; 0 when it added none or did not record the wounds before it. */
export function woundsGained(actor: unknown, options: unknown): number {
	const before = recordedBefore(options).previousWounds;
	if (typeof before !== 'number') return 0;
	return Math.max(0, numberAt(actor, ACTOR_WOUNDS_PATHS.value) - before);
}
