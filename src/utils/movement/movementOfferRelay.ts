import { SYSTEM_ID } from '#system';
import type { MovementOfferRef } from '#types/movement.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { buildCardMovementOffer, canUserTakeMovementOffer } from './buildCardMovementOffer.js';
import { type MovementOfferEntry, mergeMovementOfferEntry } from './movementOfferEntry.js';

/** Same channel as the other card relays: only the author or a GM may update a chat message. */
const MOVEMENT_OFFER_SOCKET_NAME = `system.${SYSTEM_ID}`;
const MOVEMENT_OFFER_REQUEST_TYPE = 'movementOffer.stamp';

export interface MovementOfferStamp {
	movedSpaces: number | null;
	stopped: boolean;
}

interface MovementOfferStampRequest {
	type: typeof MOVEMENT_OFFER_REQUEST_TYPE;
	ref: MovementOfferRef;
	stamp: MovementOfferStamp;
	userId: string;
}

interface StampableMessage {
	system?: { movementOffers?: MovementOfferEntry[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

function sanitiseStamp(stamp: Partial<MovementOfferStamp> | null | undefined): MovementOfferStamp {
	const moved = stamp?.movedSpaces;
	return {
		movedSpaces:
			typeof moved === 'number' && Number.isFinite(moved) ? Math.max(0, Math.floor(moved)) : null,
		stopped: stamp?.stopped === true,
	};
}

/**
 * Writes the entry on the GM's client. The entry is rebuilt from the card, so
 * a request can only say which offer was taken and how far the drag went.
 * A relayed request must come from a player who may take that offer.
 */
async function executeMovementOfferStamp(
	ref: MovementOfferRef,
	stamp: MovementOfferStamp,
	requestingUserId: string,
	viaSocket: boolean,
): Promise<void> {
	if (!game.user?.isGM) return;
	const card = buildCardMovementOffer(ref);
	if (!card) return;

	if (viaSocket) {
		const user = game.users?.get(requestingUserId) as
			| { id: string | null; isGM: boolean }
			| undefined;
		// A GM stamps directly; a relayed GM claim is not one.
		if (!user || user.isGM || !canUserTakeMovementOffer(user, card)) return;
	}

	const message = game.messages?.get(ref.messageId) as StampableMessage | undefined;
	if (!message?.update) return;
	const entries = message.system?.movementOffers ?? [];
	await message.update({
		system: {
			movementOffers: mergeMovementOfferEntry(entries, {
				id: card.offer.id,
				nodeId: ref.nodeId,
				tokenUuid: ref.tokenUuid,
				spaces: card.offer.spaces,
				used: true,
				usedBy: requestingUserId,
				...stamp,
			}),
		},
	});
}

/** Records a taken offer on its card: directly as GM, else through the primary active GM. */
export async function requestMovementOfferStamp(
	ref: MovementOfferRef,
	stamp: MovementOfferStamp,
): Promise<void> {
	if (!game.user?.id) return;
	if (game.user.isGM) {
		await executeMovementOfferStamp(ref, sanitiseStamp(stamp), game.user.id, false);
		return;
	}
	if (!getPrimaryActiveGmId()) return;
	const socket = game.socket as
		| { emit?: (eventName: string, payload: MovementOfferStampRequest) => void }
		| undefined;
	socket?.emit?.(MOVEMENT_OFFER_SOCKET_NAME, {
		type: MOVEMENT_OFFER_REQUEST_TYPE,
		ref,
		stamp,
		userId: game.user.id,
	});
}

async function handleMovementOfferStampRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;
	const request = payload as Partial<MovementOfferStampRequest>;
	if (request.type !== MOVEMENT_OFFER_REQUEST_TYPE) return;
	const ref = request.ref;
	if (!ref?.messageId || !ref.nodeId || !ref.tokenUuid || !request.userId) return;
	await executeMovementOfferStamp(
		{ messageId: ref.messageId, nodeId: ref.nodeId, tokenUuid: ref.tokenUuid },
		sanitiseStamp(request.stamp),
		request.userId,
		true,
	);
}

let didRegister = false;

/** GM-side listener for relayed offer stamps from players. Idempotent; call from ready. */
export function registerMovementOfferSocketListener(): void {
	if (didRegister) return;
	didRegister = true;
	const socket = game.socket as
		| { on?: (eventName: string, listener: (payload: unknown) => void) => void }
		| undefined;
	socket?.on?.(MOVEMENT_OFFER_SOCKET_NAME, (payload) => {
		void handleMovementOfferStampRequest(payload);
	});
}
