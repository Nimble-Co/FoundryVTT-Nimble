/** How old an Initiative card can be and still be the card of this roll. */
const RECENT_MS = 10_000;
/** A combat posts its Initiative cards after the roll is told; wait this long for the card. */
const WAIT_MS = 2_000;

interface InitiativeCard {
	type?: string;
	timestamp?: number | null;
	system?: { combatantId?: string | null };
}

function isCardOf(card: InitiativeCard, combatantId: string): boolean {
	if (card.type !== 'initiative' || card.system?.combatantId !== combatantId) return false;
	return Date.now() - (card.timestamp ?? 0) <= RECENT_MS;
}

/** The card of the Initiative roll that the combatant just made, or null when it has none. */
export async function findInitiativeCard(
	combatant: { id?: string | null } | null | undefined,
): Promise<ChatMessage | null> {
	const combatantId = combatant?.id;
	if (!combatantId) return null;
	const recent = ((game.messages?.contents ?? []) as unknown as InitiativeCard[]).slice(-20);
	const found = recent.findLast((card) => isCardOf(card, combatantId));
	if (found) return found as unknown as ChatMessage;

	return new Promise((resolve) => {
		const hookId = Hooks.on('createChatMessage', ((card: InitiativeCard) => {
			if (!isCardOf(card, combatantId)) return;
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
