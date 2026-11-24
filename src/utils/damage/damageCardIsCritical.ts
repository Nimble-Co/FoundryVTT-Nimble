interface CriticalCard {
	system?: { isCritical?: boolean; isMiss?: boolean };
}

/** Whether the chat card with this id is a crit that hit. */
export function damageCardIsCritical(cardId: string | null): boolean {
	if (!cardId) return false;
	const messages = (game as { messages?: { get?: (id: string) => unknown } }).messages;
	const system = (messages?.get?.(cardId) as CriticalCard | null | undefined)?.system;
	return system?.isCritical === true && system.isMiss !== true;
}
