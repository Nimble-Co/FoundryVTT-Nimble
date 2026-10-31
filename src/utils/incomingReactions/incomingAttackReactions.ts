import { SYSTEM_ID, systemHookName } from '#system';
import type { DieRef } from '../../dice/oneDieReroll.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import localize from '../localize.js';
import {
	type RollingReroll,
	startRerollRolling,
	stopRerollRolling,
} from '../reroll/rerollRolling.svelte.js';
import {
	type IncomingReactionEntry,
	REROLL_KEPT,
	type RerollKept,
} from './incomingReactionEntry.js';

/**
 * Foundry system socket channel. Must be `system.<id>` to reach other clients,
 * and derived from SYSTEM_ID so emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const INCOMING_REACTION_SOCKET_NAME = `system.${SYSTEM_ID}`;
const INCOMING_REACTION_REQUEST_TYPE = 'incomingAttackReaction';
const INCOMING_REACTION_REJECTED_TYPE = 'incomingAttackReactionRejected';
const REROLL_ROLLING_TYPE = 'rerollRolling';
const KEEP_CHOICE_REQUEST_TYPE = 'rerollKeep';
const DAMAGE_BACK_REQUEST_TYPE = 'damageBack';
const DAMAGE_BACK_ACTIONS = ['deal', 'double'] as const;

/**
 * Hook announcing that the GM refused an offer this client asked to use, so
 * the card's prompts can re-enable the button instead of waiting out the hold
 * they took when the request was handed off.
 */
export const INCOMING_REACTION_REJECTED_HOOK = systemHookName('incomingReactionRejected');

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
	/** reroll only: the player confirmed using a heroic reaction already spent */
	forceHeroicReaction?: boolean;
	/** reroll only: the die the player picked */
	die?: DieRef;
	/** change only: the face the player set the die to */
	value?: number;
};

type KeepChoiceRequest = {
	type: typeof KEEP_CHOICE_REQUEST_TYPE;
	messageId: string;
	userId: string;
	choice: RerollKept;
};

type DamageBackRequest = {
	type: typeof DAMAGE_BACK_REQUEST_TYPE;
	messageId: string;
	recordId: string;
	action: (typeof DAMAGE_BACK_ACTIONS)[number];
	userId: string;
};

/** Why the GM refused, as a localization key the asking client renders. */
export interface IncomingReactionRejection {
	messageId: string;
	entryId: string;
	userId: string;
	reasonKey: string;
}

type IncomingReactionRejectedMessage = IncomingReactionRejection & {
	type: typeof INCOMING_REACTION_REJECTED_TYPE;
};

type RerollRollingMessage = {
	type: typeof REROLL_ROLLING_TYPE;
	messageId: string;
	/** Null when the dice stopped with no new result. */
	roll: RollingReroll | null;
};

interface ReactionCapableMessage {
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
	resolveRerollReaction?: (
		entryId: string,
		requestingUserId: string,
		viaSocket?: boolean,
		forceHeroicReaction?: boolean,
		die?: DieRef | null,
		value?: number | null,
	) => Promise<void>;
	resolveKeepChoice?: (
		choice: RerollKept,
		requestingUserId: string,
		viaSocket?: boolean,
	) => Promise<void>;
	resolveDamageBack?: (
		recordId: string,
		action: (typeof DAMAGE_BACK_ACTIONS)[number],
		requestingUserId: string,
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
	forceHeroicReaction?: boolean,
	die?: DieRef | null,
	value?: number | null,
): Promise<void> {
	const message = getMessageById(messageId);
	if (!message) return;

	const entry = message.system?.incomingReactions?.find((e) => e.id === entryId);
	if (!entry) return;

	// The executors revalidate (unused entry, ownership, rule still enabled, and
	// — for socket-relayed requests — that the unauthenticated userId is not
	// claiming GM identity). A legacy kind has no executor and is ignored.
	if (entry.kind === 'redirectToSelf') {
		await message.resolveRedirectReaction?.(entryId, requestingUserId, viaSocket);
	} else if (entry.kind === 'spendPoolForDamage') {
		if (!selection) return;
		await message.resolveSpendPoolForDamageOffer?.(entryId, requestingUserId, selection, viaSocket);
	} else if (entry.kind === 'reroll') {
		await message.resolveRerollReaction?.(
			entryId,
			requestingUserId,
			viaSocket,
			forceHeroicReaction === true,
			die ?? null,
			value ?? null,
		);
	}
}

/** A face from a socket payload, or null when it is not a whole number above 0. */
function faceFrom(value: unknown): number | null {
	return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/** A die reference from a socket payload, or null when it is not one. */
function dieRefFrom(value: unknown): DieRef | null {
	const ref = value as Partial<DieRef> | null | undefined;
	const index = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0;
	return ref && index(ref.term) && index(ref.result)
		? { term: ref.term as number, result: ref.result as number }
		: null;
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
		request.forceHeroicReaction === true,
		dieRefFrom(request.die),
		faceFrom(request.value),
	);
}

async function handleKeepChoiceRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	const request = payload as Partial<KeepChoiceRequest> | null;
	if (!request?.messageId || !request.userId) return;
	const choice = REROLL_KEPT.find((kept) => kept === request.choice);
	if (!choice) return;
	await getMessageById(request.messageId)?.resolveKeepChoice?.(choice, request.userId, true);
}

async function handleDamageBackRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	const request = payload as Partial<DamageBackRequest> | null;
	if (!request?.messageId || !request.recordId || !request.userId) return;
	const action = DAMAGE_BACK_ACTIONS.find((known) => known === request.action);
	if (!action) return;
	await getMessageById(request.messageId)?.resolveDamageBack?.(
		request.recordId,
		action,
		request.userId,
		true,
	);
}

/**
 * Surface a refusal on the client that asked for it: a notification saying why,
 * and a hook so the card's prompts stop holding the button.
 */
function deliverIncomingReactionRejection(rejection: IncomingReactionRejection): void {
	ui.notifications?.warn(localize(rejection.reasonKey));
	// @ts-expect-error - nimble.incomingReactionRejected is a custom Nimble hook
	Hooks.callAll(INCOMING_REACTION_REJECTED_HOOK, rejection);
}

function handleIncomingReactionRejected(payload: unknown): void {
	if (!payload || typeof payload !== 'object') return;

	const rejection = payload as Partial<IncomingReactionRejectedMessage>;
	if (rejection.type !== INCOMING_REACTION_REJECTED_TYPE) return;
	if (!rejection.messageId || !rejection.entryId || !rejection.reasonKey) return;
	if (rejection.userId !== game.user?.id) return;

	deliverIncomingReactionRejection(rejection as IncomingReactionRejection);
}

/**
 * Tell the requesting client the GM did not carry out their offer. Executors
 * run on the GM's client, so without this the notification lands on the GM's
 * screen while the player who made the pick just watches the button come back
 * unexplained once its hold lapses.
 */
export function rejectIncomingAttackReaction(rejection: IncomingReactionRejection): void {
	if (rejection.userId === game.user?.id) {
		deliverIncomingReactionRejection(rejection);
		return;
	}

	const socket = game.socket as
		| {
				emit?: (eventName: string, payload: IncomingReactionRejectedMessage) => void;
		  }
		| undefined;
	socket?.emit?.(INCOMING_REACTION_SOCKET_NAME, {
		type: INCOMING_REACTION_REJECTED_TYPE,
		...rejection,
	});
}

function applyRerollRolling(messageId: string, roll: RollingReroll | null): void {
	if (roll) startRerollRolling(messageId, roll);
	else stopRerollRolling(messageId, false);
}

function handleRerollRolling(payload: unknown): void {
	const message = payload as Partial<RerollRollingMessage> | null;
	if (typeof message?.messageId !== 'string' || !message.messageId) return;
	const roll = message.roll;
	if (roll && (typeof roll.slot !== 'string' || typeof roll.faces !== 'number')) return;
	applyRerollRolling(message.messageId, roll ?? null);
}

/** Show a card's rolling reroll die on every client, or stop it with `null`. */
export function broadcastRerollRolling(messageId: string, roll: RollingReroll | null): void {
	applyRerollRolling(messageId, roll);
	const socket = game.socket as
		| { emit?: (eventName: string, payload: RerollRollingMessage) => void }
		| undefined;
	socket?.emit?.(INCOMING_REACTION_SOCKET_NAME, { type: REROLL_ROLLING_TYPE, messageId, roll });
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
		const type = (payload as { type?: string } | null)?.type;
		if (type === INCOMING_REACTION_REQUEST_TYPE) void handleIncomingReactionRequest(payload);
		else if (type === INCOMING_REACTION_REJECTED_TYPE) handleIncomingReactionRejected(payload);
		else if (type === REROLL_ROLLING_TYPE) handleRerollRolling(payload);
		else if (type === KEEP_CHOICE_REQUEST_TYPE) void handleKeepChoiceRequest(payload);
		else if (type === DAMAGE_BACK_REQUEST_TYPE) void handleDamageBackRequest(payload);
	});
}

/**
 * Use a pending offer on an attack card. GMs execute directly; everyone else
 * relays to the primary active GM, who owns the message mutation.
 *
 * Routing every kind through the GM narrows `incomingReactions` to a single
 * writing client, and is also a permission requirement: a chat message is
 * updatable only by its author or a GM, which owning the acting actor does not
 * imply. Serializing the resolvers on that client is the executors' own job.
 */
export async function requestIncomingAttackReaction(params: {
	messageId: string;
	entryId: string;
	selection?: PoolSpendSelection;
	forceHeroicReaction?: boolean;
	die?: DieRef;
	value?: number;
}): Promise<boolean> {
	if (!game.user?.id) return false;

	if (game.user.isGM) {
		await executeIncomingReaction(
			params.messageId,
			params.entryId,
			game.user.id,
			false,
			params.selection,
			params.forceHeroicReaction,
			params.die ?? null,
			params.value ?? null,
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
		...(params.forceHeroicReaction ? { forceHeroicReaction: true } : {}),
		...(params.die ? { die: params.die } : {}),
		...(params.value ? { value: params.value } : {}),
	});
	return true;
}

/**
 * Keep the new roll or the old one of the reroll that waits on a card. GMs
 * execute directly; everyone else asks the primary active GM.
 */
export async function requestKeepChoice(params: {
	messageId: string;
	choice: RerollKept;
}): Promise<boolean> {
	if (!game.user?.id) return false;

	if (game.user.isGM) {
		await getMessageById(params.messageId)?.resolveKeepChoice?.(params.choice, game.user.id, false);
		return true;
	}

	if (!getPrimaryActiveGmId()) return false;
	const socket = game.socket as
		| { emit?: (eventName: string, payload: KeepChoiceRequest) => void }
		| undefined;
	if (!socket?.emit) return false;

	socket.emit(INCOMING_REACTION_SOCKET_NAME, {
		type: KEEP_CHOICE_REQUEST_TYPE,
		messageId: params.messageId,
		userId: game.user.id,
		choice: params.choice,
	});
	return true;
}

/** Deal damage given back, or pay a Wound to double it. A player's click goes to the primary GM. */
export async function requestDamageBack(
	messageId: string,
	recordId: string,
	action: (typeof DAMAGE_BACK_ACTIONS)[number],
): Promise<void> {
	if (!game.user?.id) return;
	if (game.user.isGM) {
		await getMessageById(messageId)?.resolveDamageBack?.(recordId, action, game.user.id, false);
		return;
	}
	if (!getPrimaryActiveGmId()) return;
	const socket = game.socket as
		| { emit?: (eventName: string, payload: DamageBackRequest) => void }
		| undefined;
	socket?.emit?.(INCOMING_REACTION_SOCKET_NAME, {
		type: DAMAGE_BACK_REQUEST_TYPE,
		messageId,
		recordId,
		action,
		userId: game.user.id,
	});
}
