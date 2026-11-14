import type { CardEvent } from '#types/cardEvent.d.ts';
import { askActiveGm } from '#utils/askActiveGm.js';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';

/** The card of a line with a button. */
export interface LineCard {
	id?: string | null;
	type?: string;
	flags?: Record<string, unknown>;
	system?: unknown;
	getFlag?(scope: string, key: string): unknown;
}

const stateOf = (event: CardEvent) => (event.action as { state?: string } | undefined)?.state;

/**
 * Marks `line` with `marked` first, only while it is still in its state, so of two clicks one
 * acts; then `run` acts. An error puts the line back, only while it is still marked. False when
 * another click marked it first.
 */
export async function runMarked(
	card: LineCard,
	line: CardEvent,
	marked: CardEvent,
	run: () => Promise<boolean>,
): Promise<boolean> {
	if (!(await replaceCardEvent(card as never, line.id, marked, { ifState: stateOf(line) }))) {
		return false;
	}
	try {
		return await run();
	} catch (error) {
		await replaceCardEvent(card as never, line.id, line, { ifState: stateOf(marked) });
		throw error;
	}
}

/**
 * A line whose button the active GM acts on (`actHere`); another client asks it with
 * `queryName`. `register` adds the query.
 */
export function activeGmLine(
	queryName: string,
	actHere: (card: LineCard, eventId: string) => Promise<boolean>,
) {
	return {
		async click(card: LineCard, event: CardEvent): Promise<boolean> {
			if (!card.id) return false;
			if (game.user?.isActiveGM) return actHere(card, event.id);
			return (await askActiveGm(queryName, { messageId: card.id, eventId: event.id })) === true;
		},
		register(): void {
			Hooks.once('init', () => {
				const queries = CONFIG.queries as unknown as Record<
					string,
					(data: never) => Promise<boolean>
				>;
				queries[queryName] = async (data: { messageId?: string; eventId?: string }) => {
					const card = game.messages?.get(data.messageId ?? '') as unknown as LineCard | undefined;
					if (!card?.id || !data.eventId) return false;
					return actHere(card, data.eventId);
				};
			});
		},
	};
}
