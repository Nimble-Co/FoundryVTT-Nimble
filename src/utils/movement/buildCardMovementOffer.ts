import type { EffectNode, MoveNode } from '#types/effectTree.js';
import type { MovementOffer, MovementOfferRef } from '#types/movement.js';
import { flattenEffectsTree } from '../treeManipulation/flattenEffectsTree.js';
import { buildMovementOfferId } from './movementOfferEntry.js';
import { resolveMoveDistance } from './resolveMoveDistance.js';

export interface OfferActor {
	isOwner?: boolean;
	getRollData(): Record<string, unknown>;
	testUserPermission?(user: unknown, level: number): boolean;
	system?: { attributes?: { movement?: { walk?: number }; sizeCategory?: string } };
}

export interface OfferToken {
	id: string | null;
	uuid: string;
	name: string;
	actor?: OfferActor | null;
}

export interface OfferMessage {
	id: string | null;
	author?: { id: string | null } | null;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null };
	system?: {
		actorName?: string;
		targets?: string[];
		activation?: { effects?: EffectNode[] };
	};
}

export interface CardMovementOffer {
	offer: MovementOffer;
	node: MoveNode;
	message: OfferMessage;
	token: OfferToken;
	sourceName: string;
}

interface Lookups {
	message?: OfferMessage | null;
	resolveToken?: (uuid: string) => OfferToken | null;
	resolveActor?: (id: string) => OfferActor | null;
}

function speakerTokenUuid(message: OfferMessage): string | null {
	const speaker = message.speaker;
	return speaker?.scene && speaker.token ? `Scene.${speaker.scene}.Token.${speaker.token}` : null;
}

/** The token uuids a move node applies to on this card. */
export function cardMoveRecipients(message: OfferMessage, node: MoveNode): string[] {
	if (node.recipient === 'self') {
		const uuid = speakerTokenUuid(message);
		return uuid ? [uuid] : [];
	}
	return message.system?.targets ?? [];
}

/**
 * Rebuilds a move node's offer for one recipient from the card itself, so a
 * relayed request only ever names the card, the node and the token. Null when
 * the card has no such node or the token is not one of its recipients.
 */
export function buildCardMovementOffer(
	ref: MovementOfferRef,
	lookups: Lookups = {},
): CardMovementOffer | null {
	const message =
		lookups.message === undefined
			? ((game.messages?.get(ref.messageId) as unknown as OfferMessage | undefined) ?? null)
			: lookups.message;
	if (!message) return null;

	const effects = message.system?.activation?.effects ?? [];
	const node = flattenEffectsTree(effects).find(
		(candidate): candidate is MoveNode => candidate.id === ref.nodeId && candidate.type === 'move',
	);
	if (!node) return null;
	if (!cardMoveRecipients(message, node).includes(ref.tokenUuid)) return null;

	const resolveToken =
		lookups.resolveToken ??
		((uuid: string) =>
			(fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0]) as unknown as OfferToken | null) ??
			null);
	const token = resolveToken(ref.tokenUuid);
	if (!token?.actor) return null;

	const resolveActor =
		lookups.resolveActor ??
		((id: string) => (game.actors?.get(id) as unknown as OfferActor) ?? null);
	const sourceUuid = speakerTokenUuid(message);
	const sourceActor =
		(sourceUuid ? resolveToken(sourceUuid)?.actor : null) ??
		(message.speaker?.actor ? resolveActor(message.speaker.actor) : null) ??
		token.actor;

	const sourceName = message.system?.actorName ?? '';
	return {
		offer: {
			id: buildMovementOfferId(ref),
			tokenUuid: ref.tokenUuid,
			kind: node.kind,
			spaces: resolveMoveDistance(node, sourceActor, token.actor),
			ignoreDifficultTerrain: node.kind === 'forced' || node.ignoreDifficultTerrain,
			direction: node.direction,
			chooser: node.chooser,
			label: sourceName,
			messageId: ref.messageId,
		},
		node,
		message,
		token,
		sourceName,
	};
}

/** The GM, the card's author (the feature's user) and the recipient's owner may take an offer. */
export function canUserTakeMovementOffer(
	user: { id: string | null; isGM: boolean } | null | undefined,
	card: CardMovementOffer,
): boolean {
	if (!user) return false;
	if (user.isGM) return true;
	if (card.message.author?.id === user.id) return true;
	return (
		card.token.actor?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) === true
	);
}
