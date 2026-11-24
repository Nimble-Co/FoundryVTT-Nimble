import type { WoundSource } from './pendingWound.js';

interface SpeakingMessage {
	speaker?: { alias?: string | null } | null;
	speakerActor?: { uuid?: string | null; name?: string | null } | null;
}

/** Who a chat card says caused a Wound: the actor that speaks it, else the speaker's name. */
export function woundSourceOfMessage(message: unknown): WoundSource | null {
	try {
		const card = message as SpeakingMessage | null | undefined;
		if (!card) return null;
		const actor = card.speakerActor;
		if (actor && (actor.uuid || actor.name)) {
			return { uuid: actor.uuid ?? null, name: actor.name ?? card.speaker?.alias ?? null };
		}
		const alias = card.speaker?.alias;
		return alias ? { uuid: null, name: alias } : null;
	} catch {
		return null;
	}
}

/** The Wound source of the chat card with this id. */
export function woundSourceOfCard(cardId: string | null): WoundSource | null {
	if (!cardId) return null;
	const messages = (game as { messages?: { get?: (id: string) => unknown } }).messages;
	return woundSourceOfMessage(messages?.get?.(cardId));
}

/** The Wound source for the actor with this uuid, with its name when this client can find it. */
export function woundSourceOfUuid(uuid: string | null | undefined): WoundSource | null {
	if (!uuid) return null;
	let name: string | null = null;
	try {
		name = (fromUuidSync(uuid as never) as { name?: string | null } | null)?.name ?? null;
	} catch {
		name = null;
	}
	return { uuid, name };
}
