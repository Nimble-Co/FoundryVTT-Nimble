import { SYSTEM_ID } from '#system';
import type { ChaosCardDoc, ChaosRollChoice } from '#types/chaos.d.ts';
import { askActiveGm } from '#utils/askActiveGm.js';
import {
	CHAOS_INVOKED_FLAG,
	chooseChaosRoll,
	invokeChaos,
	keepChaosRoll,
} from '#utils/chaos/invokeChaos.js';
import {
	regainInitiativeManaOnCard,
	rerollInitiativeManaDieOnCard,
} from '#utils/combat/initiativeManaRoll.js';

const QUERY_NAME = `${SYSTEM_ID}.cardAction`;

export type CardAction =
	| { name: 'chaosChoose'; choice: ChaosRollChoice }
	| { name: 'chaosKeep'; index: number }
	| { name: 'chaosInvoke' }
	| { name: 'initiativeManaReroll'; index: number }
	| { name: 'initiativeManaRegain' };

interface ActionCard {
	id?: string | null;
	isAuthor?: boolean;
	speaker?: unknown;
	system?: { actorUuid?: string };
	setFlag?(scope: string, key: string, value: unknown): Promise<unknown>;
}

/** The GM, the author of the card, and a player who owns the hero of the card. */
export function canActOnCard(
	card: Pick<ActionCard, 'isAuthor'>,
	actor: { isOwner?: boolean } | null | undefined,
): boolean {
	return game.user?.isGM === true || card.isAuthor === true || actor?.isOwner === true;
}

const actorOf = (card: ActionCard) =>
	fromUuidSync(card.system?.actorUuid as never) as unknown as never;

async function runHere(card: ActionCard, action: CardAction): Promise<void> {
	switch (action.name) {
		case 'chaosChoose':
			return chooseChaosRoll(card as unknown as ChaosCardDoc, actorOf(card), action.choice);
		case 'chaosKeep':
			return keepChaosRoll(card as unknown as ChaosCardDoc, action.index);
		case 'chaosInvoke':
			await card.setFlag?.(SYSTEM_ID, CHAOS_INVOKED_FLAG, true);
			return invokeChaos(ChatMessage.getSpeakerActor(card.speaker as never) as never, card.id);
		case 'initiativeManaReroll':
			return rerollInitiativeManaDieOnCard(card as never, action.index);
		case 'initiativeManaRegain':
			return regainInitiativeManaOnCard(card as never, actorOf(card));
	}
}

/** Only the GM and its author can change a card, so a player who owns the hero asks the GM. */
export async function runCardAction(card: ActionCard, action: CardAction): Promise<void> {
	if (game.user?.isGM === true || card.isAuthor === true) return runHere(card, action);
	await askActiveGm(QUERY_NAME, { messageId: card.id, action });
}

export function registerCardActionQuery(): void {
	Hooks.once('init', () => {
		const queries = CONFIG.queries as unknown as Record<string, (data: never) => Promise<boolean>>;
		queries[QUERY_NAME] = async (data: { messageId: string; action: CardAction }) => {
			const card = game.messages?.get(data.messageId) as unknown as ActionCard | undefined;
			if (!card) return false;
			await runHere(card, data.action);
			return true;
		};
	});
}
