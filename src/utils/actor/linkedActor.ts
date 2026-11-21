import { SYSTEM_ID } from '#system';

/** Effect flag: the creature an effect is tied to, so its moments and its card can find them. */
const LINKED_ACTOR_FLAG = 'linkedActorUuid';

interface FlagHolder {
	flags?: Record<string, Record<string, unknown> | undefined>;
}

/** The uuid of the creature an effect is tied to, or null when it is tied to none. */
export function linkedActorUuidOf(effect: FlagHolder): string | null {
	const uuid = effect.flags?.[SYSTEM_ID]?.[LINKED_ACTOR_FLAG];
	return typeof uuid === 'string' && uuid ? uuid : null;
}

/** The system flags that tie a new effect to `uuid`. Undefined ties it to nobody. */
export function linkedActorFlags(
	uuid: string | null | undefined,
): Record<string, string> | undefined {
	return uuid ? { [LINKED_ACTOR_FLAG]: uuid } : undefined;
}
