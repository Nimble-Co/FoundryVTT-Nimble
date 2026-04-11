/**
 * Canonical property paths for actor HP / wound fields that `updateActor` hook
 * handlers need to watch. Centralizing these keeps listeners consistent when
 * the system data shape changes.
 */
export const ACTOR_HP_PATHS = {
	value: 'system.attributes.hp.value',
	max: 'system.attributes.hp.max',
	lastStandThreshold: 'system.attributes.hp.lastStandThreshold',
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
