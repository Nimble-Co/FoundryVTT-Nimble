import type { IncomingReactionEntry } from './incomingAttackModifiers.js';

const INCOMING_REACTION_SOCKET_NAME = 'system.nimble';
const INCOMING_REACTION_REQUEST_TYPE = 'incomingAttackReaction';

type IncomingReactionRequest = {
	type: typeof INCOMING_REACTION_REQUEST_TYPE;
	messageId: string;
	entryId: string;
	userId: string;
};

interface ReactionCapableMessage {
	resolveForceRerollReaction?: (entryId: string, requestingUserId: string) => Promise<void>;
	resolveRedirectReaction?: (entryId: string, requestingUserId: string) => Promise<void>;
	system?: { incomingReactions?: IncomingReactionEntry[] };
}

function getPrimaryActiveGmId(): string | null {
	const usersCollection = game.users as unknown as {
		activeGM?: { id?: string | null } | null;
		contents?: Array<{ active?: boolean; id?: string | null; isGM?: boolean }>;
	};
	const activeGmId = usersCollection.activeGM?.id ?? null;
	if (activeGmId) return activeGmId;
	return (
		usersCollection.contents?.find((user) => user.isGM === true && user.active === true)?.id ?? null
	);
}

function getMessageById(messageId: string | null | undefined): ReactionCapableMessage | null {
	if (!messageId) return null;
	return (game.messages?.get(messageId) as unknown as ReactionCapableMessage | null) ?? null;
}

async function executeIncomingReaction(
	messageId: string,
	entryId: string,
	requestingUserId: string,
): Promise<void> {
	const message = getMessageById(messageId);
	if (!message) return;

	const entry = message.system?.incomingReactions?.find((e) => e.id === entryId);
	if (!entry) return;

	// The executors revalidate (unused entry, ownership, rule still enabled).
	if (entry.kind === 'forceReroll') {
		await message.resolveForceRerollReaction?.(entryId, requestingUserId);
	} else if (entry.kind === 'redirectToSelf') {
		await message.resolveRedirectReaction?.(entryId, requestingUserId);
	}
}

async function handleIncomingReactionRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<IncomingReactionRequest>;
	if (request.type !== INCOMING_REACTION_REQUEST_TYPE) return;
	if (!request.messageId || !request.entryId || !request.userId) return;

	await executeIncomingReaction(request.messageId, request.entryId, request.userId);
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
 * Use a pending incoming-attack reaction on an attack card. GMs execute
 * directly; players relay the request to the primary active GM, who owns the
 * message mutation.
 */
export async function requestIncomingAttackReaction(params: {
	messageId: string;
	entryId: string;
}): Promise<boolean> {
	if (!game.user?.id) return false;

	if (game.user.isGM) {
		await executeIncomingReaction(params.messageId, params.entryId, game.user.id);
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
	});
	return true;
}
