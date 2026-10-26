import type { NimbleChatMessage } from '#documents/chatMessage.ts';
import type { HeldIncomingReactions } from '#types/components/IncomingReactionPrompts.d.ts';
import {
	INCOMING_REACTION_REJECTED_HOOK,
	type IncomingReactionRejection,
} from '#utils/incomingAttackReactions.js';

/**
 * Offers whose request has been handed off but whose result has not come
 * back yet. For a player the request is a socket emit, so it returns long
 * before the GM writes `used: true`; leaving the offer clickable in that
 * window lets a second confirm read the same unspent pool and fold the
 * bonus twice for one set of dice.
 *
 * A refusal releases the hold as soon as it reaches us, so the button comes
 * back with an explanation rather than in silence. The timer is the fallback
 * for a refusal that never arrives (the GM disconnecting mid-request). The
 * executor holds its own lock for the correctness half of this.
 */
const SPEND_HOLD_DURATION = 10_000;

/** Call during component setup: the rejection hook lives as long as the component. */
export function createHeldIncomingReactions(
	message: NimbleChatMessage | undefined,
): HeldIncomingReactions {
	let heldEntryIds = $state(new Set<string>());

	function release(entryId: string): void {
		const next = new Set(heldEntryIds);
		if (next.delete(entryId)) heldEntryIds = next;
	}

	function hold(entryId: string): void {
		heldEntryIds = new Set(heldEntryIds).add(entryId);
		setTimeout(() => release(entryId), SPEND_HOLD_DURATION);
	}

	$effect(() => {
		const hooksApi = Hooks as unknown as {
			on: (hook: string, listener: (rejection: IncomingReactionRejection) => void) => number;
			off: (hook: string, id: number) => void;
		};
		const hookId = hooksApi.on(INCOMING_REACTION_REJECTED_HOOK, (rejection) => {
			if (rejection.messageId !== message?.id) return;
			release(rejection.entryId);
		});
		return () => hooksApi.off(INCOMING_REACTION_REJECTED_HOOK, hookId);
	});

	return {
		has: (entryId) => heldEntryIds.has(entryId),
		hold,
		release,
	};
}
