import type { EffectNode, MoveNode } from '#types/effectTree.js';
import type { ArmedMovementOffer, MovementOffer, MovementOfferState } from '#types/movement.js';
import { isMovementOffersAutomationEnabled } from '../../settings/automationSettings.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { resolveMoveDistance } from './resolveMoveDistance.js';

export interface OfferActor {
	getRollData(): Record<string, unknown>;
	system?: { attributes?: { movement?: { walk?: number }; sizeCategory?: string } };
}

export interface OfferToken {
	name: string;
	actor?: OfferActor | null;
}

/** The parts of a chat card that decide its Movement Offers. */
export interface OfferCard {
	id?: string | null;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null };
	system?: {
		targets?: string[];
		activation?: { effects?: EffectNode[] };
		movementOffers?: MovementOffer[];
	};
}

export interface OfferLookups {
	resolveToken?: (uuid: string) => OfferToken | null;
	resolveActor?: (id: string) => OfferActor | null;
	/** The feature user, when the caller already holds it. */
	source?: OfferActor | null;
}

function resolveTokenByUuid(uuid: string): OfferToken | null {
	// A uuid from another client that does not resolve here is a missing token, not an error.
	const token = fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0], { strict: false });
	return (token as unknown as OfferToken | null) ?? null;
}

function resolveActorById(id: string): OfferActor | null {
	return (game.actors?.get(id) as unknown as OfferActor | undefined) ?? null;
}

function speakerTokenUuid(card: OfferCard): string | null {
	const speaker = card.speaker;
	return speaker?.scene && speaker.token ? `Scene.${speaker.scene}.Token.${speaker.token}` : null;
}

function moveNodes(card: OfferCard): MoveNode[] {
	return flattenEffectsTree(card.system?.activation?.effects ?? []).filter(
		(node): node is MoveNode => node.type === 'move',
	);
}

/** The token uuids a move node applies to on this card. */
export function moveNodeRecipients(card: OfferCard, node: MoveNode): string[] {
	if (node.recipient === 'self') {
		const uuid = speakerTokenUuid(card);
		return uuid ? [uuid] : [];
	}
	return card.system?.targets ?? [];
}

export function movementOfferId(nodeId: string, tokenUuid: string): string {
	return `${nodeId}.${tokenUuid.split('.').at(-1) ?? ''}`;
}

/**
 * The card's Movement Offers once its recipients are set or changed. Each offer
 * is worked out once, when it is first made, so a later change to either
 * creature does not move the number on the card. A settled offer stays as the
 * record of what happened; an open one goes with its recipient.
 */
export function reconcileMovementOffers(
	card: OfferCard,
	lookups: OfferLookups = {},
): MovementOffer[] {
	const existing = card.system?.movementOffers ?? [];
	const nodes = moveNodes(card);
	if (!nodes.length) return [...existing];

	const resolveToken = lookups.resolveToken ?? resolveTokenByUuid;
	const resolveActor = lookups.resolveActor ?? resolveActorById;
	let source = lookups.source;
	const findSource = (): OfferActor | null => {
		if (source !== undefined) return source;
		const speakerUuid = speakerTokenUuid(card);
		const actorId = card.speaker?.actor;
		source =
			(speakerUuid ? resolveToken(speakerUuid)?.actor : null) ??
			(actorId ? resolveActor(actorId) : null);
		return source;
	};

	const wanted = new Set<string>();
	const made: MovementOffer[] = [];
	for (const node of nodes) {
		for (const tokenUuid of moveNodeRecipients(card, node)) {
			const id = movementOfferId(node.id, tokenUuid);
			wanted.add(id);
			if (existing.some((offer) => offer.id === id)) continue;

			const token = resolveToken(tokenUuid);
			const sourceActor = findSource();
			if (!token?.actor || !sourceActor) continue;
			made.push({
				id,
				nodeId: node.id,
				tokenUuid,
				name: token.name,
				kind: node.kind,
				spaces: resolveMoveDistance(node, sourceActor, token.actor),
				ignoreDifficultTerrain: node.kind === 'forced' || node.ignoreDifficultTerrain,
				state: 'open',
				usedBy: null,
				movedSpaces: null,
				stopped: false,
			});
		}
	}

	const kept = existing.filter((offer) => wanted.has(offer.id) || offer.state !== 'open');
	return [...kept, ...made];
}

/**
 * The Movement Offer a token carries, or null when it carries none: the newest
 * open offer to it with any distance, so a second push supersedes an unsettled
 * first one. Null whenever Movement Offers are off.
 */
export function findArmedMovementOffer(
	tokenUuid: string,
	deps: { messages?: readonly OfferCard[]; enabled?: boolean } = {},
): ArmedMovementOffer | null {
	const enabled = deps.enabled ?? isMovementOffersAutomationEnabled();
	if (!enabled || !tokenUuid) return null;

	const messages = deps.messages ?? ((game.messages?.contents ?? []) as unknown as OfferCard[]);
	for (let index = messages.length - 1; index >= 0; index--) {
		const message = messages[index];
		if (!message?.id) continue;
		const offer = message.system?.movementOffers?.find(
			(candidate) =>
				candidate.tokenUuid === tokenUuid && candidate.state === 'open' && candidate.spaces > 0,
		);
		if (offer) return { ...offer, messageId: message.id };
	}
	return null;
}

export interface MovementOfferSettlement {
	/** The Movement was made under the offer, rather than the mover going their own way. */
	taken: boolean;
	spaces: number;
	stopped: boolean;
	userId: string | null;
}

/**
 * The card's offers after a Movement settled one of them, or null when that
 * offer is missing or already settled. A taken offer keeps the spaces covered,
 * never more than it offered: what the extra spaces mean is the table's call.
 */
export function settleMovementOffer(
	offers: readonly MovementOffer[],
	offerId: string,
	settlement: MovementOfferSettlement,
): MovementOffer[] | null {
	const offer = offers.find((candidate) => candidate.id === offerId);
	if (!offer || offer.state !== 'open') return null;

	const { taken } = settlement;
	const settled: MovementOffer = {
		...offer,
		state: taken ? 'taken' : 'unused',
		usedBy: settlement.userId,
		movedSpaces: taken ? Math.min(settlement.spaces, offer.spaces) : null,
		stopped: taken && settlement.stopped,
	};
	return offers.map((candidate) => (candidate.id === offerId ? settled : candidate));
}

/** What the card reports for one offer. */
export interface MovementOfferOutcome {
	state: MovementOfferState;
	offered: number;
	moved: number | null;
	/** Spaces a wall, terrain or the mover cut off a taken offer. */
	shortfall: number;
	/** A push cut short: the book deals damage per space shortened. */
	damageOwed: boolean;
}

export function movementOfferOutcome(offer: MovementOffer): MovementOfferOutcome {
	const moved = offer.state === 'taken' ? (offer.movedSpaces ?? 0) : null;
	const shortfall = moved !== null && offer.stopped ? Math.max(0, offer.spaces - moved) : 0;
	return {
		state: offer.state,
		offered: offer.spaces,
		moved,
		shortfall,
		damageOwed: offer.kind === 'forced' && shortfall > 0,
	};
}
