import { SYSTEM_ID, systemHookName } from '#system';
import type { MoveNode } from '#types/effectTree.js';
import type { MovementOffer, MovementOfferOutcome, MovementRecord } from '#types/movement.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import { isActiveGM } from '../isActiveGM.js';
import localize from '../localize.js';
import { requestMove } from './requestMove.js';

/** Same channel as the other card relays: only the author or a GM may update a chat message. */
const MOVEMENT_OFFER_SOCKET_NAME = `system.${SYSTEM_ID}`;
const MOVEMENT_OFFER_REQUEST_TYPE = 'movementOffer.update';

export interface MovementOfferEntry {
	id: string;
	nodeId: string;
	tokenUuid: string;
	spaces: number;
	used: boolean;
	usedBy: string | null;
	movedSpaces: number | null;
	stopped: boolean;
}

interface MovementOfferUpdateRequest {
	type: typeof MOVEMENT_OFFER_REQUEST_TYPE;
	messageId: string;
	patch: Partial<MovementOfferEntry> & { id: string };
	userId: string;
}

interface OfferMessage {
	system?: { movementOffers?: MovementOfferEntry[] };
	update?: (changes: Record<string, unknown>) => Promise<unknown>;
}

export function buildMovementOfferId(messageId: string, nodeId: string, tokenId: string): string {
	return `${messageId}.${nodeId}.${tokenId}`;
}

/**
 * Upserts one entry. The drag start (from the mover) and the drag result
 * (from the active GM) can land in either order, so both merge over what is
 * already there.
 */
export function mergeMovementOfferEntry(
	entries: readonly MovementOfferEntry[],
	patch: Partial<MovementOfferEntry> & { id: string },
): MovementOfferEntry[] {
	const existing = entries.find((entry) => entry.id === patch.id);
	const defined = Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined),
	) as Partial<MovementOfferEntry> & { id: string };
	const merged: MovementOfferEntry = {
		nodeId: '',
		tokenUuid: '',
		spaces: 0,
		used: false,
		usedBy: null,
		movedSpaces: null,
		stopped: false,
		...existing,
		...defined,
	};
	return existing
		? entries.map((entry) => (entry.id === patch.id ? merged : entry))
		: [...entries, merged];
}

async function executeMovementOfferUpdate(
	messageId: string,
	patch: Partial<MovementOfferEntry> & { id: string },
): Promise<void> {
	if (!game.user?.isGM) return;
	const message = game.messages?.get(messageId) as OfferMessage | undefined;
	if (!message?.update) return;
	const entries = message.system?.movementOffers ?? [];
	await message.update({ system: { movementOffers: mergeMovementOfferEntry(entries, patch) } });
}

async function requestMovementOfferUpdate(
	messageId: string,
	patch: Partial<MovementOfferEntry> & { id: string },
): Promise<void> {
	if (!game.user?.id) return;
	if (game.user.isGM) {
		await executeMovementOfferUpdate(messageId, patch);
		return;
	}
	if (!getPrimaryActiveGmId()) return;
	const socket = game.socket as
		| { emit?: (eventName: string, payload: MovementOfferUpdateRequest) => void }
		| undefined;
	socket?.emit?.(MOVEMENT_OFFER_SOCKET_NAME, {
		type: MOVEMENT_OFFER_REQUEST_TYPE,
		messageId,
		patch,
		userId: game.user.id,
	});
}

/**
 * Takes a Movement Offer from a card's `move` node for one recipient token:
 * offers the drag to the token's owner and, once it starts, records the use
 * on the card. The system never moves the token itself.
 */
export async function takeMovementOffer(params: {
	messageId: string;
	node: MoveNode;
	token: { id: string | null; uuid: string; name: string };
	spaces: number;
	label: string;
}): Promise<MovementOfferOutcome> {
	const { messageId, node, token, spaces, label } = params;
	const id = buildMovementOfferId(messageId, node.id, token.id ?? '');
	const offer: MovementOffer = {
		id,
		tokenUuid: token.uuid,
		kind: node.kind,
		spaces,
		ignoreDifficultTerrain: node.kind === 'forced' || node.ignoreDifficultTerrain,
		direction: node.direction,
		chooser: node.chooser,
		label,
		messageId,
	};

	const outcome = await requestMove(offer);
	if (outcome === 'started') {
		await requestMovementOfferUpdate(messageId, {
			id,
			nodeId: node.id,
			tokenUuid: token.uuid,
			spaces,
			used: true,
			usedBy: game.user?.id ?? null,
		});
	} else if (outcome === 'unavailable') {
		ui.notifications?.warn(
			localize('NIMBLE.chat.movementOffers.unavailable', { name: token.name }),
		);
	}
	return outcome;
}

async function handleMovementOfferRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM || (game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;
	const request = payload as Partial<MovementOfferUpdateRequest>;
	if (request.type !== MOVEMENT_OFFER_REQUEST_TYPE) return;
	if (!request.messageId || !request.patch?.id || !request.userId) return;
	await executeMovementOfferUpdate(request.messageId, {
		...request.patch,
		usedBy: request.userId,
	});
}

let didRegister = false;

/**
 * GM-side listeners: relayed use stamps from players, and the drag result from
 * the movement record once an offered drag lands. Idempotent; call from ready.
 */
export function registerMovementOfferListeners(): void {
	if (didRegister) return;
	didRegister = true;

	const socket = game.socket as
		| { on?: (eventName: string, listener: (payload: unknown) => void) => void }
		| undefined;
	socket?.on?.(MOVEMENT_OFFER_SOCKET_NAME, (payload) => {
		void handleMovementOfferRequest(payload);
	});

	// @ts-expect-error - movementFinished is a custom system hook
	Hooks.on(systemHookName('movementFinished'), (record: MovementRecord) => {
		if (!isActiveGM() || !record.offer?.messageId) return;
		void executeMovementOfferUpdate(record.offer.messageId, {
			id: record.offer.id,
			used: true,
			movedSpaces: record.spaces,
			stopped: record.stopped,
		});
	});
}
