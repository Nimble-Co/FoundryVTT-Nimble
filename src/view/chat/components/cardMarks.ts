import { SYSTEM_ID } from '#system';
import { marksOfItem } from '#utils/actor/markLifecycle.ts';
import type { ToggledTargetEntry } from '#utils/actor/toggledEffects.ts';

type MarkingItem = Parameters<typeof marksOfItem>[0];

interface MarkCard {
	flags?: Record<string, { itemId?: unknown } | undefined>;
	speakerActor?: { isOwner?: boolean; items?: { get(id: string): unknown } } | null;
}

/**
 * The item that posted the card, when the user owns its actor. Null
 * otherwise, so nobody else sees a way to end a mark.
 */
export function cardMarkingItem(card: MarkCard | undefined): MarkingItem | null {
	const itemId = card?.flags?.[SYSTEM_ID]?.itemId;
	const actor = card?.speakerActor;
	if (typeof itemId !== 'string' || !actor?.isOwner) return null;
	return (actor.items?.get(itemId) as MarkingItem | undefined) ?? null;
}

/** The item's marks, read through the owner's `reactive`, so a view updates when they change. */
export function liveMarksOf(item: MarkingItem): ToggledTargetEntry[] {
	const owner = item.actor as (MarkingItem['actor'] & { reactive?: MarkingItem['actor'] }) | null;
	return marksOfItem({ uuid: item.uuid, rules: item.rules, actor: owner?.reactive ?? owner });
}

/** The mark the item holds on the creature of this token, if any. */
export function markOnToken(
	marks: readonly ToggledTargetEntry[],
	token: { uuid?: string; actor?: { uuid?: string } | null } | null | undefined,
): ToggledTargetEntry | null {
	if (!token) return null;
	return (
		marks.find((mark) => mark.tokenUuid === token.uuid || mark.actorUuid === token.actor?.uuid) ??
		null
	);
}
