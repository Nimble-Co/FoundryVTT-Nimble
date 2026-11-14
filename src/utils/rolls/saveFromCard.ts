import { SYSTEM_ID } from '#system';

/** The save step of a card that asked for a save: on the save card it made. */
export interface AskedBy {
	cardId: string;
	nodeId: string;
}

interface FlaggedCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

const flagsOf = (card: FlaggedCard | null | undefined) =>
	(card?.flags?.[SYSTEM_ID] ?? {}) as { itemUuid?: string; askedBy?: AskedBy };

/** The item of the card as a tag: its identifier, or else its name as a slug. */
function itemTag(card: FlaggedCard): string {
	const uuid = flagsOf(card).itemUuid;
	const item = uuid
		? (fromUuidSync(uuid as never, { strict: false }) as {
				name?: string | null;
				system?: { identifier?: string };
			} | null)
		: null;
	const identifier = item?.system?.identifier?.trim();
	if (identifier) return identifier;
	return (item?.name ?? '').slugify({ strict: true });
}

/**
 * The roll options of a save from a card's save step: the card and the step it answers, and the
 * tags `save:from` and `save:from:<item>`.
 */
export function saveFromCardOptions(
	card: FlaggedCard,
	nodeId: string,
): { cardFlags?: { askedBy: AskedBy }; rollTags: string[] } {
	const tag = itemTag(card);
	return {
		...(card.id ? { cardFlags: { askedBy: { cardId: card.id, nodeId } } } : {}),
		rollTags: ['save:from', ...(tag ? [`save:from:${tag}`] : [])],
	};
}

/** The save step a save card answers, or null for a save that no card asked for. */
export function askedByOf(saveCard: FlaggedCard | null | undefined): AskedBy | null {
	const asked = flagsOf(saveCard).askedBy;
	return asked?.cardId && asked.nodeId ? asked : null;
}
