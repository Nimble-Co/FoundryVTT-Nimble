import type { CardEventLink } from '#types/cardEvent.d.ts';
import { docLink } from '#utils/documents/docLink.ts';

/** A document name of a card text, with the uuid that opens it when the uuid is known. */
export function cardEventLink(
	name: string | null | undefined,
	uuid?: string | null,
): CardEventLink {
	return { link: docLink(name, uuid) };
}

/** The uuid of an effect on a creature, or null when either id is missing. */
export function effectUuidOn(
	holderUuid: string | null | undefined,
	effectId: string | null | undefined,
): string | null {
	return holderUuid && effectId ? `${holderUuid}.ActiveEffect.${effectId}` : null;
}
