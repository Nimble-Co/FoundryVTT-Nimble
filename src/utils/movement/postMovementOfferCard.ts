import type { MoveNode } from '#types/effectTree.js';
import type { OfferActor, OfferCard } from '#types/movement.js';
import { movementCardWhisper } from './movementCardWhisper.js';
import { reconcileMovementOffers } from './movementOffers.js';

export interface MovementOfferCardInput {
	/** The source of the offer, and the speaker. */
	actor: Actor;
	/** The source's token, and the speaker. */
	token: TokenDocument;
	/** The card title. */
	name: string;
	image?: string;
	/** One localized line that says why the offer was made. */
	reason: string;
	node: Pick<MoveNode, 'kind' | 'distance' | 'ignoreDifficultTerrain' | 'direction'> &
		Partial<Pick<MoveNode, 'distanceBySize'>>;
	/** 'self' offers to the speaker token; a list of token uuids offers to those tokens. */
	recipients: 'self' | string[];
	/** Whether only the owners of the source and of each creature with an offer, and the GMs, see the card. */
	whisper: boolean;
}

function tokenActor(tokenUuid: string): Actor | null {
	const token = fromUuidSync(tokenUuid as Parameters<typeof fromUuidSync>[0], { strict: false });
	return (token as TokenDocument | null)?.actor ?? null;
}

/**
 * Posts a Movement Offer that no item activation made. The card is born with
 * its offers, the same as an activation card. Posts nothing when no creature
 * gets an offer, as when there is no recipient or the distance comes to zero.
 */
export async function postMovementOfferCard(
	input: MovementOfferCardInput,
): Promise<ChatMessage | null> {
	const { actor, token } = input;
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

	chatData.system.movementOffers = reconcileMovementOffers(chatData as unknown as OfferCard, {
		source: actor as unknown as OfferActor,
	});
	const offered = chatData.system.movementOffers.filter((offer) => offer.spaces > 0);
	if (offered.length === 0) return null;

	const whisper = input.whisper
		? movementCardWhisper([actor, ...offered.map((offer) => tokenActor(offer.tokenUuid))])
		: [];

	return (
		(await ChatMessage.create({ ...chatData, whisper } as unknown as ChatMessage.CreateData)) ??
		null
	);
}
