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
	const value = foundry.utils.getProperty(actor as object, path);
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** HP the update added; 0 when it added none or did not record the HP before it. */
export function hpGained(actor: unknown, options: unknown): number {
	const before = recordedBefore(options).previousHp?.value;
	if (typeof before !== 'number') return 0;
	return Math.max(0, numberAt(actor, ACTOR_HP_PATHS.value) - before);
}

/** Wounds the update added; 0 when it added none or did not record the wounds before it. */
export function woundsGained(actor: unknown, options: unknown): number {
	const before = recordedBefore(options).previousWounds;
	if (typeof before !== 'number') return 0;
	return Math.max(0, numberAt(actor, ACTOR_WOUNDS_PATHS.value) - before);
}
