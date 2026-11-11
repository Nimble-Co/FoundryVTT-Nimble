import type {
	CardEvent,
	CardEventText,
	EventHostCard,
	MovementOfferHost,
} from '#types/cardEvent.d.ts';
import type { MoveNode } from '#types/effectTree.js';
import type { MovementOffer, OfferActor, OfferCard } from '#types/movement.js';
import { addCardEvents, addMomentEvents, cardEventText } from '#utils/chat/cardEvents.js';
import { cardSchemaHas } from '#utils/documents/cardSchemaHas.js';
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
	/** Why the offer was made. Plain text shows as it is. */
	reason: CardEventText | string;
	node: Pick<MoveNode, 'kind' | 'distance' | 'ignoreDifficultTerrain' | 'direction'> &
		Partial<Pick<MoveNode, 'distanceBySize'>>;
	/** 'self' offers to the speaker token; a list of token uuids offers to those tokens. */
	recipients: 'self' | string[];
	/** Whether only the owners of the source and of each creature with an offer, and the GMs, see the card. */
	whisper: boolean;
}

interface BuiltOffer {
	node: MoveNode;
	offers: MovementOffer[];
	whisper: string[];
	chatData: Record<string, unknown> & { system: Record<string, unknown> };
}

function tokenActor(tokenUuid: string): Actor | null {
	const token = fromUuidSync(tokenUuid as Parameters<typeof fromUuidSync>[0], { strict: false });
	return (token as TokenDocument | null)?.actor ?? null;
}

function reasonText(reason: CardEventText | string): string {
	return typeof reason === 'string' ? reason : cardEventText(reason);
}

/** The offer's move and its offers. Null when no creature gets one. */
function buildOffer(input: MovementOfferCardInput): BuiltOffer | null {
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
			reason: reasonText(input.reason),
			targets: isSelf ? [] : [...(input.recipients as string[])],
			activation: { effects: [node] },
			movementOffers: [] as MovementOffer[],
		},
	};

	chatData.system.movementOffers = reconcileMovementOffers(chatData as unknown as OfferCard, {
		source: actor as unknown as OfferActor,
	});
	const offers = chatData.system.movementOffers.filter((offer) => offer.spaces > 0);
	if (offers.length === 0) return null;

	const whisper = input.whisper
		? movementCardWhisper([actor, ...offers.map((offer) => tokenActor(offer.tokenUuid))])
		: [];
	return { node, offers: chatData.system.movementOffers, whisper, chatData };
}

function offerEvent(input: MovementOfferCardInput, built: BuiltOffer): CardEvent {
	const reason: CardEventText =
		typeof input.reason === 'string'
			? { key: 'NIMBLE.chat.events.cause.source', data: { source: input.reason } }
			: input.reason;
	return {
		id: `movementOffer.${built.node.id}`,
		kind: 'movementOffer',
		...(input.image ? { img: input.image } : { icon: 'fa-solid fa-person-running' }),
		text: { key: 'NIMBLE.chat.events.movementOffer.text', data: { name: input.name } },
		cause: reason,
		action: { kind: 'movementOffer', node: built.node, offers: built.offers },
		at: Date.now(),
	};
}

/** A whispered offer goes only on a card that no one else reads. */
function readersWithin(card: EventHostCard, whisper: readonly string[]): boolean {
	if (whisper.length < 1) return true;
	const readers = card.whisper ?? [];
	if (readers.length < 1) return false;
	const allowed = new Set(whisper);
	return readers.every((id) => !!id && allowed.has(id));
}

async function placeOnHost(
	host: MovementOfferHost,
	event: CardEvent,
	whisper: string[],
): Promise<boolean> {
	if ('card' in host) {
		const { card } = host;
		if (!cardSchemaHas(card.type, 'movementOffers') || !readersWithin(card, whisper)) return false;
		return addCardEvents(card, [event]);
	}
	if ('moment' in host) return addMomentEvents(host.moment, [event], { whisper });
	if (whisper.length > 0) return false;
	return host.activation.add([event]);
}

function createOfferCard(built: BuiltOffer): Promise<ChatMessage | null | undefined> {
	return ChatMessage.create({
		...built.chatData,
		whisper: built.whisper,
	} as unknown as ChatMessage.CreateData);
}

/**
 * Posts a Movement Offer that no item activation made. The card is born with
 * its offers, the same as an activation card. Posts nothing when no creature
 * gets an offer, as when there is no recipient or the distance comes to zero.
 */
export async function postMovementOfferCard(
	input: MovementOfferCardInput,
): Promise<ChatMessage | null> {
	const built = buildOffer(input);
	if (!built) return null;
	return (await createOfferCard(built)) ?? null;
}

/**
 * Makes a Movement Offer as a line on the host card, which then stores the offers, so the tokens
 * carry them as from an offer card. With no host that can show the line, posts the offer card.
 * True when a creature got an offer.
 */
export async function offerMovement(
	input: MovementOfferCardInput,
	host: MovementOfferHost | null,
): Promise<boolean> {
	const built = buildOffer(input);
	if (!built) return false;
	if (host && (await placeOnHost(host, offerEvent(input, built), built.whisper))) return true;
	return !!(await createOfferCard(built));
}
