import { getContext } from 'svelte';
import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import { cardTargets, cardUser } from '#utils/chat/applyEffectFromCard.ts';

/**
 * A step row on a card: the card, whether this user may click the step, whether it has a
 * creature to go to, and one click at a time. Call it while the component starts.
 */
export function createCardStep(run: (card: NimbleChatMessage) => Promise<unknown>) {
	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');
	let busy = $state(false);

	return {
		/** Null when the row is not on a card. */
		rowContext(recipient: 'self' | 'targets' | 'savers') {
			const card = messageDocument?.reactive;
			if (!card) return null;
			return {
				card,
				canApply: !!game.user?.isGM || card.author?.id === game.user?.id,
				hasRecipient: recipient === 'self' ? !!cardUser(card) : cardTargets(card).length > 0,
			};
		},
		get busy() {
			return busy;
		},
		async apply() {
			if (!messageDocument || busy) return;
			busy = true;
			try {
				await run(messageDocument);
			} finally {
				busy = false;
			}
		},
	};
}
