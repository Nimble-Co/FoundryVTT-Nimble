import { type CardRequester, defineCardOperation } from './cardOperations.js';

interface DamageCard {
	applyAllDamageRequested(requester: CardRequester): Promise<boolean>;
}

/** A player who owns one of the card's targets asks the GM to apply the card's damage. */
export const requestApplyCardDamage = defineCardOperation<{ messageId: string }>({
	type: 'applyCardDamage',
	noGmKey: 'NIMBLE.chat.noGmToApplyDamage',
	parse(raw) {
		const messageId = raw.messageId;
		if (typeof messageId !== 'string' || !messageId) return null;
		return { messageId };
	},
	async run(payload, requester) {
		const card = game.messages?.get(payload.messageId) as Partial<DamageCard> | undefined;
		return (await card?.applyAllDamageRequested?.(requester)) ?? false;
	},
});
