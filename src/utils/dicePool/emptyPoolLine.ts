import type { CardEvent, EmptyPoolAction } from '#types/cardEvent.d.ts';
import { replaceCardEvent } from '#utils/chat/cardEvents.js';
import { mayActHere } from '#utils/chat/cardOperations.js';
import { setPoolFaces } from '#utils/dicePool/dicePoolRefill.js';
import { type EndingEffect, poolsEmptiedAtEnd } from '#utils/dicePool/poolsEmptiedAtEnd.js';

/** The delete option of an end that puts its own lines on a card (`endEffects`). */
export const END_LINES_OPTION = 'nimbleEndLines';

const WORDS = 'NIMBLE.chat.emptyPool';

interface LineCard {
	id?: string | null;
	flags?: Record<string, unknown>;
}

interface NamedEffect extends EndingEffect {
	name?: string | null;
}

/**
 * Feature Effects off: a waiting line for each pool that holds dice and that an Empty Pools at End
 * rule of the effects empties. Read before the effects go.
 */
export function emptyPoolEvents(effects: readonly NamedEffect[], at: number): CardEvent[] {
	const lines: CardEvent[] = [];
	for (const effect of effects) {
		const emptied = poolsEmptiedAtEnd(effect);
		if (!emptied) continue;
		const holder = emptied.holder as { uuid?: string; name?: string | null };
		for (const pool of emptied.pools) {
			if (pool.faces.length < 1) continue;
			const action: EmptyPoolAction = {
				kind: 'emptyPool',
				holderUuid: holder.uuid ?? '',
				holderName: holder.name ?? '',
				poolId: pool.id,
				poolLabel: pool.label,
				state: 'waiting',
			};
			lines.push({
				id: `emptyPool.${action.holderUuid}.${pool.id}.${at}`,
				kind: 'emptyPool',
				icon: 'fa-solid fa-dice',
				text: { key: `${WORDS}.text`, data: { pool: pool.label } },
				cause: {
					key: 'NIMBLE.lastsUntil.chat.ended',
					data: { effect: effect.name ?? '', name: action.holderName },
				},
				action,
				at,
			});
		}
	}
	return lines;
}

/** The owner of the holder, or a GM, empties the pool. */
export function canEmptyPool(action: EmptyPoolAction): boolean {
	return mayActHere(action.holderUuid);
}

/**
 * A click empties the pool of a waiting line. The line is marked first, only while it still waits,
 * so of two clicks one empties; an error puts it back.
 */
export async function emptyPoolFromLine(card: LineCard, event: CardEvent): Promise<boolean> {
	const action = event.action;
	if (action?.kind !== 'emptyPool' || action.state !== 'waiting' || !card.id) return false;
	if (!canEmptyPool(action)) return false;
	const holder = fromUuidSync(action.holderUuid as never, { strict: false }) as Actor | null;
	if (!holder) return false;
	const emptied: CardEvent = {
		...event,
		text: { key: `${WORDS}.emptied`, data: { pool: action.poolLabel } },
		action: { ...action, state: 'emptied' },
	};
	if (!(await replaceCardEvent(card as never, event.id, emptied, { ifState: 'waiting' }))) {
		return false;
	}
	try {
		await setPoolFaces(holder, action.poolId, []);
	} catch (error) {
		await replaceCardEvent(card as never, event.id, event);
		throw error;
	}
	return true;
}
