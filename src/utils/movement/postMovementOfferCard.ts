import type { MoveNode } from '#types/effectTree.js';
import {
	moveNodeRecipients,
	type OfferActor,
	type OfferCard,
	reconcileMovementOffers,
} from './movementOffers.js';

export interface MovementOfferCardInput {
	/** The source of the offer, and the speaker. */
	actor: Actor;
	/** The source's token. Defaults to its first active token on the viewed scene. */
	token?: TokenDocument | null;
	/** The feature name, shown as the card title. */
	name: string;
	image?: string;
	/** One localized line that says why the offer was made. */
	reason: string;
	node: Pick<MoveNode, 'kind' | 'distance' | 'ignoreDifficultTerrain' | 'direction' | 'chooser'> &
		Partial<Pick<MoveNode, 'distanceBySize'>>;
	/** 'self' offers to the speaker token; a list of token uuids offers to those tokens. */
	recipients: 'self' | string[];
}

function defaultToken(actor: Actor): TokenDocument | null {
	const token = actor.getActiveTokens()[0] as { document?: TokenDocument } | undefined;
	return token?.document ?? null;
}

/**
 * Posts a Movement Offer that no item activation made. The card is born with
 * its offers, the same as an activation card. Posts nothing when the offer has
 * no recipient.
 */
export async function postMovementOfferCard(
	input: MovementOfferCardInput,
): Promise<ChatMessage | null> {
	const { actor } = input;
	const token = input.token === undefined ? defaultToken(actor) : input.token;
	const isSelf = input.recipients === 'self';

	const node: MoveNode = {
		id: foundry.utils.randomID(),
		type: 'move',
		kind: input.node.kind,
		recipient: isSelf ? 'self' : 'targets',
		distance: input.node.distance,
		distanceBySize: { ...(input.node.distanceBySize ?? {}) },
		ignoreDifficultTerrain: input.node.ignoreDifficultTerrain,
		direction: input.node.direction,
		chooser: input.node.chooser,
		parentContext: null,
		parentNode: null,
	};

	const chatData = {
		author: game.user?.id,
		speaker: ChatMessage.getSpeaker({ actor, token }),
		type: 'movementOffer',
		system: {
			actorName: actor.name ?? '',
			actorType: actor.type ?? '',
			image: input.image || 'icons/svg/item-bag.svg',
			permissions: actor.permission ?? 0,
			rollMode: 0,
			name: input.name,
			reason: input.reason,
			targets: isSelf ? [] : [...(input.recipients as string[])],
			activation: { effects: [node] },
			movementOffers: [] as ReturnType<typeof reconcileMovementOffers>,
		},
	};

	const card = chatData as unknown as OfferCard;
	if (moveNodeRecipients(card, node).length === 0) return null;

	chatData.system.movementOffers = reconcileMovementOffers(card, {
		source: actor as unknown as OfferActor,
	});

	return (await ChatMessage.create(chatData as unknown as ChatMessage.CreateData)) ?? null;
}
