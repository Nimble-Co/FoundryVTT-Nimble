import { SYSTEM_ID, systemHookName } from '#system';
import type { CardRequestRejection } from '#types/cardRequestRejection.d.ts';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import localize from '../localize.js';

/**
 * Foundry system socket channel. Must be `system.<id>` to reach other clients,
 * and derived from SYSTEM_ID so emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const CARD_SOCKET_NAME = `system.${SYSTEM_ID}`;
const REJECTED_TYPE = 'incomingAttackReactionRejected';

/**
 * Hook announcing that the GM refused an operation this client asked for, so
 * the card's prompts can re-enable the button instead of waiting out the hold
 * they took when the request was handed off.
 */
const CARD_REQUEST_REJECTED_HOOK = systemHookName('incomingReactionRejected');

/** Who asked for an operation, and whether the request came over the socket. */
interface CardRequester {
	userId: string;
	viaSocket: boolean;
}

/** One command on a chat card that only the primary active GM may write. */
interface CardOperation<TPayload> {
	/** The socket message type. */
	type: string;
	/** The payload of a socket message, or null when it is not one. */
	parse(raw: Record<string, unknown>): TPayload | null;
	/** Runs on the primary active GM's client. Resolves false when it was refused. */
	run(payload: TPayload, requester: CardRequester): Promise<unknown>;
	/** Shown to a player when no GM is connected to run the operation. */
	noGmKey?: string;
}

type SocketPayload = Record<string, unknown> & { type?: unknown; userId?: unknown };
type Emitter = { emit?: (eventName: string, payload: unknown) => void } | undefined;

const operations = new Map<string, CardOperation<unknown>>();
const notices = new Map<string, (payload: SocketPayload) => void>();

/**
 * Define a command on a chat card. A chat message is updatable only by its
 * author or a GM, which owning the acting actor does not imply, so a GM runs
 * the command at once and a player's request goes to the primary active GM.
 * The returned `request` resolves false when nothing could run it, or when
 * this GM's own run was refused.
 */
function defineCardOperation<TPayload extends object>(
	operation: CardOperation<TPayload>,
): (payload: TPayload) => Promise<boolean> {
	operations.set(operation.type, operation as CardOperation<unknown>);
	return async (payload) => {
		const userId = game.user?.id;
		if (!userId) return false;
		if (game.user?.isGM) {
			return (await operation.run(payload, { userId, viaSocket: false })) !== false;
		}
		const socket = game.socket as Emitter;
		if (!getPrimaryActiveGmId() || !socket?.emit) {
			if (operation.noGmKey) ui.notifications?.warn(localize(operation.noGmKey));
			return false;
		}
		socket.emit(CARD_SOCKET_NAME, { ...payload, type: operation.type, userId });
		return true;
	};
}

/** Handle a socket message that every client gets, such as the rolling dice of a card. */
function onCardNotice(type: string, handle: (payload: SocketPayload) => void): void {
	notices.set(type, handle);
}

/** Send a notice to every other client. */
function sendCardNotice(type: string, payload: Record<string, unknown>): void {
	(game.socket as Emitter)?.emit?.(CARD_SOCKET_NAME, { ...payload, type });
}

/** A GM, or a player who owns the actor. A GM's request may not come over the socket. */
function mayActFor(actor: object | string | null, requester: CardRequester): boolean {
	const user = game.users?.get(requester.userId) ?? null;
	if (!user) return false;
	if (user.isGM) return !requester.viaSocket;
	const found = typeof actor === 'string' ? fromUuidSync(actor as `Actor.${string}`) : actor;
	const owned = found as { testUserPermission?: (user: User, level: number) => boolean } | null;
	return owned?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) === true;
}

/** The same rule for this client's own user: whether it shows a control that acts for the actor. */
function mayActHere(actor: { isOwner?: boolean } | string | null | undefined): boolean {
	if (game.user?.isGM) return true;
	const found = typeof actor === 'string' ? fromUuidSync(actor as `Actor.${string}`) : actor;
	return (found as { isOwner?: boolean } | null | undefined)?.isOwner === true;
}

function deliverRejection(rejection: CardRequestRejection): void {
	ui.notifications?.warn(localize(rejection.reasonKey));
	// @ts-expect-error - nimble.incomingReactionRejected is a custom Nimble hook
	Hooks.callAll(CARD_REQUEST_REJECTED_HOOK, rejection);
}

/**
 * Tell the asking client the GM did not carry out their request. Operations
 * run on the GM's client, so without this the notification lands on the GM's
 * screen while the player who asked just watches the button come back.
 */
function rejectCardRequest(rejection: CardRequestRejection): void {
	if (rejection.userId === game.user?.id) {
		deliverRejection(rejection);
		return;
	}
	sendCardNotice(REJECTED_TYPE, { ...rejection });
}

onCardNotice(REJECTED_TYPE, (payload) => {
	const { messageId, entryId, userId, reasonKey } = payload;
	if (typeof messageId !== 'string' || typeof reasonKey !== 'string' || !reasonKey) return;
	if (userId !== game.user?.id) return;
	deliverRejection({
		messageId,
		...(typeof entryId === 'string' && entryId ? { entryId } : {}),
		userId,
		reasonKey,
	});
});

async function handleOperation(operation: CardOperation<unknown>, payload: SocketPayload) {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (typeof payload.userId !== 'string' || !payload.userId) return;
	const parsed = operation.parse(payload);
	if (parsed === null) return;
	await operation.run(parsed, { userId: payload.userId, viaSocket: true });
}

let registered = false;

/** Listen on the system channel for every card operation and notice. */
function registerCardSocketListener(): void {
	if (registered) return;
	registered = true;
	const socket = game.socket as
		| { on?: (eventName: string, listener: (payload: unknown) => void) => void }
		| undefined;
	socket?.on?.(CARD_SOCKET_NAME, (raw) => {
		if (!raw || typeof raw !== 'object') return;
		const payload = raw as SocketPayload;
		const type = typeof payload.type === 'string' ? payload.type : '';
		const operation = operations.get(type);
		if (operation) {
			void handleOperation(operation, payload);
			return;
		}
		notices.get(type)?.(payload);
	});
}

export {
	CARD_REQUEST_REJECTED_HOOK,
	defineCardOperation,
	mayActFor,
	mayActHere,
	onCardNotice,
	registerCardSocketListener,
	rejectCardRequest,
	sendCardNotice,
};
