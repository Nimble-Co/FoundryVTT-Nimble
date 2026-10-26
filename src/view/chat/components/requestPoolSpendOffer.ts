import PoolSpendOfferDialog from '#documents/dialogs/PoolSpendOfferDialog.svelte.ts';
import { getDicePoolConsumers } from '#utils/dicePool/dicePoolConsumers.js';
import { getPools as getDicePools } from '#utils/dicePool/dicePoolSync.js';
import { requestIncomingAttackReaction } from '#utils/incomingAttackReactions.js';
import type { IncomingReactionEntry } from '#utils/incomingReactionEntry.ts';
import localize from '../../../utils/localize.js';

/**
 * Which pool and item does this offer's consumer belong to? Asked of the live
 * rules rather than stamped on the entry, so an author retargeting the
 * consumer does not strand offers on cards already posted.
 */
function findOfferTarget(
	actor: Actor.Implementation,
	entry: IncomingReactionEntry,
): { poolId: string; itemId: string | null } | null {
	const sourceItemId = entry.itemUuid
		? ((fromUuidSync(entry.itemUuid) as { id?: string } | null)?.id ?? null)
		: null;

	for (const pool of getDicePools(actor)) {
		const match = getDicePoolConsumers(actor, pool, { includeCardOffers: true }).find(
			(consumer) =>
				consumer.ruleId === entry.ruleId && (!sourceItemId || consumer.itemId === sourceItemId),
		);
		if (match) return { poolId: pool.id, itemId: match.itemId };
	}
	return null;
}

/**
 * The dice are picked on the spending player's own client, then the chosen
 * selection is relayed like any other reaction: the message mutation is the
 * GM's to make, both because a chat message is only updatable by its author
 * or a GM and because one writer keeps concurrent reactions from clobbering
 * each other.
 */
export async function requestPoolSpendOffer(
	entry: IncomingReactionEntry,
	options: {
		actor: Actor.Implementation;
		label: string;
		messageId: string;
		/** Holds the entry once the request is about to go out. */
		hold: (entryId: string) => void;
	},
): Promise<void> {
	const { actor } = options;
	const target = findOfferTarget(actor, entry);
	if (!target) {
		ui.notifications?.warn(localize('NIMBLE.chat.incomingReactions.poolSpendUnavailable'));
		return;
	}

	const dialog = new PoolSpendOfferDialog(
		actor,
		target.poolId,
		entry.ruleId,
		target.itemId,
		options.label,
	);
	dialog.render(true);
	const selection = await dialog.promise;
	if (!selection) return;

	options.hold(entry.id);
	await requestIncomingAttackReaction({
		messageId: options.messageId,
		entryId: entry.id,
		selection,
	});
}
