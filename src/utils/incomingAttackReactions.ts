import { SYSTEM_ID } from '#system';
import { getPrimaryActiveGmId } from './getPrimaryActiveGmId.js';
import type { IncomingReactionEntry } from './incomingReactionEntry.js';

/**
 * Foundry system socket channel. Must be `system.<id>` to reach other clients,
 * and derived from SYSTEM_ID so emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const INCOMING_REACTION_SOCKET_NAME = `system.${SYSTEM_ID}`;
const INCOMING_REACTION_REQUEST_TYPE = 'incomingAttackReaction';

/**
 * The dice a player committed in the card-side spend picker. `expectedFaces`
 * is what the picker showed them: the executor re-reads the live pool, so
 * without it a pool that changed mid-dialog would silently spend whichever
 * dice now sit at those indices.
 */
export interface PoolSpendSelection {
	poolId: string;
	faceIndices: number[];
	expectedFaces: number[];
}

type IncomingReactionRequest = {
	type: typeof INCOMING_REACTION_REQUEST_TYPE;
	messageId: string;
	entryId: string;
	userId: string;
	/** spendPoolForDamage only */
	selection?: PoolSpendSelection;
};

interface ReactionCapableMessage {
	resolveForceRerollReaction?: (
		entryId: string,
		requestingUserId: string,
		viaSocket?: boolean,
	) => Promise<void>;
	resolveRedirectReaction?: (
		entryId: string,
		requestingUserId: string,
		viaSocket?: boolean,
	) => Promise<void>;
	resolveSpendPoolForDamageOffer?: (
		entryId: string,
		requestingUserId: string,
		selection: PoolSpendSelection,
		viaSocket?: boolean,
	) => Promise<void>;
	system?: { incomingReactions?: IncomingReactionEntry[] };
}

function getMessageById(messageId: string | null | undefined): ReactionCapableMessage | null {
	if (!messageId) return null;
	return (game.messages?.get(messageId) as unknown as ReactionCapableMessage | null) ?? null;
}

async function executeIncomingReaction(
	messageId: string,
	entryId: string,
	requestingUserId: string,
	viaSocket: boolean,
	selection?: PoolSpendSelection,
): Promise<void> {
	const message = getMessageById(messageId);
	if (!message) return;

	const entry = message.system?.incomingReactions?.find((e) => e.id === entryId);
	if (!entry) return;

	// The executors revalidate (unused entry, ownership, rule still enabled, and
	// — for socket-relayed requests — that the unauthenticated userId is not
	// claiming GM identity).
	if (entry.kind === 'forceReroll') {
		await message.resolveForceRerollReaction?.(entryId, requestingUserId, viaSocket);
	} else if (entry.kind === 'redirectToSelf') {
		await message.resolveRedirectReaction?.(entryId, requestingUserId, viaSocket);
	} else if (entry.kind === 'spendPoolForDamage') {
		if (!selection) return;
		await message.resolveSpendPoolForDamageOffer?.(entryId, requestingUserId, selection, viaSocket);
	}
}

async function handleIncomingReactionRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<IncomingReactionRequest>;
	if (request.type !== INCOMING_REACTION_REQUEST_TYPE) return;
	if (!request.messageId || !request.entryId || !request.userId) return;

	await executeIncomingReaction(
		request.messageId,
		request.entryId,
		request.userId,
		true,
		request.selection,
	);
}

let hasRegisteredIncomingReactionSocketListener = false;

export function registerIncomingReactionSocketListener(): void {
	if (hasRegisteredIncomingReactionSocketListener) return;
	hasRegisteredIncomingReactionSocketListener = true;

	const socket = game.socket as
		| {
				on?: (eventName: string, listener: (payload: unknown) => void) => void;
		  }
		| undefined;
	socket?.on?.(INCOMING_REACTION_SOCKET_NAME, (payload) => {
		void handleIncomingReactionRequest(payload);
	});
}

/**
 * Use a pending offer on an attack card. GMs execute directly; everyone else
 * relays to the primary active GM, who owns the message mutation.
 *
 * Routing every kind through the GM is what keeps `incomingReactions` to a
 * single writer, and is also a permission requirement: a chat message is
 * updatable only by its author or a GM, which owning the acting actor does not
 * imply.
 */
export async function requestIncomingAttackReaction(params: {
	messageId: string;
	entryId: string;
	selection?: PoolSpendSelection;
}): Promise<boolean> {
	if (!game.user?.id) return false;

	if (game.user.isGM) {
		await executeIncomingReaction(
			params.messageId,
			params.entryId,
			game.user.id,
			false,
			params.selection,
		);
		return true;
	}

	if (!getPrimaryActiveGmId()) return false;

	const socket = game.socket as
		| {
				emit?: (eventName: string, payload: IncomingReactionRequest) => void;
		  }
		| undefined;
	if (!socket?.emit) return false;

	socket.emit(INCOMING_REACTION_SOCKET_NAME, {
		type: INCOMING_REACTION_REQUEST_TYPE,
		messageId: params.messageId,
		entryId: params.entryId,
		userId: game.user.id,
		...(params.selection ? { selection: params.selection } : {}),
	});
	return true;
}
