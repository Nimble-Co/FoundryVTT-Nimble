import { SYSTEM_ID } from '#system';

/** Effect flag: the creature an effect is tied to, so its moments and its card can find them. */
const HELD_ACTOR_FLAG = 'heldActorUuid';

interface FlagHolder {
	flags?: Record<string, Record<string, unknown> | undefined>;
}

interface NamedDocument {
	uuid?: string | null;
	name?: string | null;
	documentName?: string;
}

/** The uuid of the creature an effect is tied to, or null when it is tied to none. */
export function heldActorUuidOf(effect: FlagHolder): string | null {
	const uuid = effect.flags?.[SYSTEM_ID]?.[HELD_ACTOR_FLAG];
	return typeof uuid === 'string' && uuid ? uuid : null;
}

/** The system flags that tie a new effect to `uuid`. Undefined ties it to nobody. */
export function heldActorFlags(
	uuid: string | null | undefined,
): Record<string, string> | undefined {
	return uuid ? { [HELD_ACTOR_FLAG]: uuid } : undefined;
}

/**
 * The creature an effect is tied to. A real actor when the world has one, else a
 * document that only names them, or null when the effect names none.
 */
export function heldActorOf(effect: FlagHolder): Actor | NamedDocument | null {
	const uuid = heldActorUuidOf(effect);
	if (!uuid) return null;
	const document = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], {
		strict: false,
	}) as (NamedDocument & object) | null;
	if (!document) return null;
	if (document instanceof Actor) return document;
	return document.documentName === 'Actor' ? document : null;
}
