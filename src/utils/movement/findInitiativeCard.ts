import { SYSTEM_ID } from '#system';

/** A combat posts its Initiative cards after the roll is told; wait this long for the card. */
const WAIT_MS = 2_000;

interface InitiativeCard {
	type?: string;
	system?: { combatantId?: string | null };
	flags?: Record<string, { initiativeRollId?: string } | undefined>;
}

function isCardOf(card: InitiativeCard, combatantId: string, rollId: string): boolean {
	if (card.type !== 'initiative' || card.system?.combatantId !== combatantId) return false;
	return card.flags?.[SYSTEM_ID]?.initiativeRollId === rollId;
}

/**
 * The card of the Initiative roll `rollId` that the combatant made, or null when it has none. The
 * roll id is on the card, so no clock decides which card it is.
 */
export async function findInitiativeCard(
	combatant: { id?: string | null } | null | undefined,
	rollId: string | null | undefined,
): Promise<ChatMessage | null> {
	const combatantId = combatant?.id;
	if (!combatantId || !rollId) return null;
	const recent = ((game.messages?.contents ?? []) as unknown as InitiativeCard[]).slice(-20);
	const found = recent.findLast((card) => isCardOf(card, combatantId, rollId));
	if (found) return found as unknown as ChatMessage;

	return new Promise((resolve) => {
		const hookId = Hooks.on('createChatMessage', ((card: InitiativeCard) => {
			if (!isCardOf(card, combatantId, rollId)) return;
			Hooks.off('createChatMessage', hookId);
			clearTimeout(timer);
			resolve(card as unknown as ChatMessage);
		}) as never);
		const timer = setTimeout(() => {
			Hooks.off('createChatMessage', hookId);
			resolve(null);
		}, WAIT_MS);
	});
}
