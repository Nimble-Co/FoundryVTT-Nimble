import { SYSTEM_ID } from '#system';
import type { GrantedActivationType } from '../models/rules/grantActivation.js';
import { getPrimaryActiveGmId } from './getPrimaryActiveGmId.js';

/**
 * Foundry system socket channel. Must be `system.<id>` so the request reaches the GM's
 * client, and derived from SYSTEM_ID so the emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const GRANTED_ACTION_OFFER_SOCKET_NAME = `system.${SYSTEM_ID}`;
const GRANTED_ACTION_OFFER_REQUEST_TYPE = 'grantedActionOffer';

const GRANT_ACTIVATION_RULE_TYPE = 'grantActivation';

/**
 * A pending granted-activation offer stamped onto the granting item's chat
 * card. Snapshotted on the activating client at card creation so every client
 * sees the same offer; the executing GM revalidates lightly on use. Offers
 * carry no expiry — like the incoming-attack reaction entries, they simply
 * remain available until used.
 */
interface GrantedActionOffer {
	id: string;
	/** Recipient actor (token-actor uuid, so unlinked tokens resolve) */
	targetActorUuid: string;
	/** Rule label or granting item name, surfaced for chat attribution */
	label: string;
	/** What the recipient is offered (drives their selectable item list) */
	activationType: GrantedActivationType;
	ruleId: string;
	/** The granting item, for revalidating that the rule still exists and is enabled */
	sourceItemUuid: string;
	used: boolean;
	/** Id of the user who consumed the offer */
	usedBy: string | null;
}

interface GrantedActionOfferRequest {
	type: typeof GRANTED_ACTION_OFFER_REQUEST_TYPE;
	messageId: string;
	offerId: string;
	userId: string;
}

interface GrantActivationRuleLike {
	type?: string;
	id?: string;
	label?: string;
	activationType?: GrantedActivationType;
	appliesTo?: () => boolean;
}

interface OfferGrantingItem {
	uuid?: string;
	name?: string;
	actor?: { uuid?: string } | null;
	rules?: Map<string, GrantActivationRuleLike> | null;
}

interface OfferTargetToken {
	actor?: { uuid?: string } | null;
}

/**
 * Build the granted-activation offers a used item extends to the user's
 * current targets, one offer per (rule, target actor). The activating actor
 * never receives an offer from their own activation.
 */
export function collectGrantedActionOffers(
	item: OfferGrantingItem,
	targets: OfferTargetToken[],
): GrantedActionOffer[] {
	const rules =
		item.rules && typeof item.rules.values === 'function' ? [...item.rules.values()] : [];
	const grantRules = rules.filter(
		(rule) => rule?.type === GRANT_ACTIVATION_RULE_TYPE && rule.appliesTo?.(),
	);
	if (grantRules.length < 1) return [];

	const sourceActorUuid = item.actor?.uuid ?? '';
	const offersByKey = new Map<string, GrantedActionOffer>();

	for (const rule of grantRules) {
		for (const target of targets) {
			const targetActorUuid = target.actor?.uuid ?? '';
			if (!targetActorUuid || targetActorUuid === sourceActorUuid) continue;

			const key = `${rule.id ?? ''}:${targetActorUuid}`;
			if (offersByKey.has(key)) continue;

			offersByKey.set(key, {
				id: foundry.utils.randomID(),
				targetActorUuid,
				label: rule.label || item.name || '',
				activationType: rule.activationType ?? 'weaponAttack',
				ruleId: rule.id ?? '',
				sourceItemUuid: item.uuid ?? '',
				used: false,
				usedBy: null,
			});
		}
	}

	return Array.from(offersByKey.values());
}

interface OfferBearingMessage {
	system?: { grantedActionOffers?: GrantedActionOffer[] };
	update?: (data: Record<string, unknown>) => Promise<unknown>;
}

function getMessageById(messageId: string | null | undefined): OfferBearingMessage | null {
	if (!messageId) return null;
	return (game.messages?.get(messageId) as unknown as OfferBearingMessage | null) ?? null;
}

/**
 * Validate a pending offer before stamping it used. Eligibility was
 * snapshotted at card creation; this is a light revalidation only: the offer
 * must exist and be unused, the requesting user must be a GM or own the
 * recipient actor, and the granting rule must still exist and be enabled.
 *
 * `viaSocket` marks a player-relayed request, whose `requestingUserId` is
 * client-supplied and therefore unauthenticated over the base socket. A
 * genuine GM always executes on their own client (the direct path), so a
 * relayed request that claims GM identity is a spoof and is rejected.
 */
function validateGrantedActionOffer(
	message: OfferBearingMessage,
	offerId: string,
	requestingUserId: string,
	viaSocket: boolean,
): { offers: GrantedActionOffer[]; offer: GrantedActionOffer } | null {
	const offers = message.system?.grantedActionOffers ?? [];
	const offer = offers.find((entry) => entry.id === offerId);
	if (!offer || offer.used) return null;

	const requestingUser = game.users?.get(requestingUserId) ?? null;
	if (!requestingUser) return null;
	if (viaSocket && requestingUser.isGM) return null;
	if (!requestingUser.isGM) {
		const targetActor = fromUuidSync(
			offer.targetActorUuid as Parameters<typeof fromUuidSync>[0],
		) as Actor.Implementation | null;
		const isOwner = targetActor?.testUserPermission?.(
			requestingUser,
			CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
		);
		if (!isOwner) return null;
	}

	if (offer.sourceItemUuid) {
		const item = fromUuidSync(offer.sourceItemUuid as Parameters<typeof fromUuidSync>[0]) as {
			rules?: Map<string, { id?: string; disabled?: boolean }>;
		} | null;
		const rule = item?.rules
			? [...item.rules.values()].find((entry) => entry.id === offer.ruleId)
			: null;
		if (!rule || rule.disabled) return null;
	}

	return { offers, offer };
}

/**
 * Stamp an offer as used on the executing GM's client. The stamp is the whole
 * execution — the recipient's activation itself runs on the requesting client
 * through the normal activation flow. `used` is written in a single message
 * update, so a second request for the same offer fails the `used` check.
 */
async function executeGrantedActionOfferUse(
	messageId: string,
	offerId: string,
	requestingUserId: string,
	viaSocket: boolean,
): Promise<void> {
	if (!game.user?.isGM) return;

	const message = getMessageById(messageId);
	if (!message?.update) return;

	const found = validateGrantedActionOffer(message, offerId, requestingUserId, viaSocket);
	if (!found) return;

	const updatedOffers = found.offers.map((entry) =>
		entry.id === offerId ? { ...entry, used: true, usedBy: requestingUserId } : entry,
	);
	await message.update({
		system: { grantedActionOffers: updatedOffers },
	});
}

async function handleGrantedActionOfferRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<GrantedActionOfferRequest>;
	if (request.type !== GRANTED_ACTION_OFFER_REQUEST_TYPE) return;
	if (!request.messageId || !request.offerId || !request.userId) return;

	await executeGrantedActionOfferUse(request.messageId, request.offerId, request.userId, true);
}

let hasRegisteredGrantedActionOfferSocketListener = false;

/**
 * Registers the GM-side listener for relayed granted-activation offer
 * requests. Idempotent, so it is safe to call once from the `ready` hook.
 */
export function registerGrantedActionOfferSocketListener(): void {
	if (hasRegisteredGrantedActionOfferSocketListener) return;
	hasRegisteredGrantedActionOfferSocketListener = true;

	const socket = game.socket as
		| {
				on?: (eventName: string, listener: (payload: unknown) => void) => void;
		  }
		| undefined;
	socket?.on?.(GRANTED_ACTION_OFFER_SOCKET_NAME, (payload) => {
		void handleGrantedActionOfferRequest(payload);
	});
}

/**
 * Consume a granted-activation offer on a chat card. GMs stamp the offer
 * directly; players relay the request to the primary active GM, who owns the
 * message mutation. Call after the recipient's activation completed, so a
 * cancelled activation leaves the offer available.
 */
export async function requestGrantedActionOfferUse(params: {
	messageId: string;
	offerId: string;
}): Promise<boolean> {
	if (!game.user?.id) return false;

	if (game.user.isGM) {
		await executeGrantedActionOfferUse(params.messageId, params.offerId, game.user.id, false);
		return true;
	}

	if (!getPrimaryActiveGmId()) return false;

	const socket = game.socket as
		| {
				emit?: (eventName: string, payload: GrantedActionOfferRequest) => void;
		  }
		| undefined;
	if (!socket?.emit) return false;

	socket.emit(GRANTED_ACTION_OFFER_SOCKET_NAME, {
		type: GRANTED_ACTION_OFFER_REQUEST_TYPE,
		messageId: params.messageId,
		offerId: params.offerId,
		userId: game.user.id,
	});
	return true;
}

export type { GrantedActionOffer };
