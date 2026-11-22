import { SYSTEM_ID } from '#system';
import type {
	AfterMoveCheck,
	GrantedActivationTrigger,
	GrantedActivationType,
	GrantedWeaponKind,
} from '../../models/rules/grantActivation.js';
import { ruleLabel, rulesOfType } from '../actor/actorRules.js';
import { identifierOf } from '../documents/itemIdentifier.js';
import { getPrimaryActiveGmId } from '../getPrimaryActiveGmId.js';
import localize from '../localize.js';

/**
 * Foundry system socket channel. Must be `system.<id>` so the request reaches the GM's
 * client, and derived from SYSTEM_ID so the emitter and listener stay in lockstep across
 * the stable (`nimble`) and dev (`nimble-dev`) installs.
 */
const GRANTED_ACTION_OFFER_SOCKET_NAME = `system.${SYSTEM_ID}`;
const GRANTED_ACTION_OFFER_REQUEST_TYPE = 'grantedActionOffer';

const GRANT_ACTIVATION_RULE_TYPE = 'grantActivation';

/**
 * A pending granted-activation line stamped onto a chat card. Snapshotted on
 * the client that makes the card, with the options of its rule, so every
 * client sees the same line; the executing GM revalidates lightly on use.
 * Lines carry no expiry: like the incoming-attack reaction entries, they
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
	/** The attack spends no action. */
	free: boolean;
	/** The attack spends the recipient's reaction in place of an action. */
	spendsReaction: boolean;
	weaponKind: GrantedWeaponKind;
	/** The recipient's cantrips are choices too. */
	allowsCantrips: boolean;
	/** The attack ignores Rushed Attack disadvantage. */
	ignoresRushed: boolean;
	/** Text under the label, for a condition the table checks. */
	condition: string;
	/** How many targeted creatures the rule reaches. 0: no limit. */
	targetCount: number;
	/** How many targeted creatures got a line from the rule. More than the count: the card warns. */
	targetedCount: number;
	/** The line shows only after the user's move from the same card ends. */
	afterMove: boolean;
	/** What the card checks at the Stop, to warn when it fails. */
	afterMoveCheck: AfterMoveCheck;
	/** The mark list an adjacent creature must be on. */
	afterMoveFlagKey: string;
	afterMoveMinEnemies: number;
	/** The condition an adjacent creature must have. */
	afterMoveStatus: string;
	used: boolean;
	/** Id of the user who consumed the offer */
	usedBy: string | null;
	/** What the attack was made with. Null on a card from before it was kept. */
	usedWith?: GrantedActionOfferUsedWith | null;
}

/** The weapon, Unarmed Strike or cantrip a line was used with. The uuid is empty for Unarmed Strike. */
interface GrantedActionOfferUsedWith {
	name: string;
	uuid: string;
}

interface GrantedActionOfferRequest {
	type: typeof GRANTED_ACTION_OFFER_REQUEST_TYPE;
	messageId: string;
	offerId: string;
	userId: string;
	usedWith?: GrantedActionOfferUsedWith | null;
}

interface GrantActivationRuleLike {
	type?: string;
	id?: string;
	label?: string;
	activationType?: GrantedActivationType;
	trigger?: GrantedActivationTrigger;
	includesUser?: boolean;
	includesTargets?: boolean;
	weaponKind?: GrantedWeaponKind;
	allowsCantrips?: boolean;
	free?: boolean;
	spendsReaction?: boolean;
	ignoresRushed?: boolean;
	condition?: string;
	targetCount?: number;
	afterMoveCheck?: AfterMoveCheck;
	afterMoveFlagKey?: string;
	afterMoveMinEnemies?: number;
	afterMoveStatus?: string;
	emptyPoolIdentifier?: string;
	appliesTo?: () => boolean;
}

interface OfferGrantingItem {
	uuid?: string;
	name?: string;
	identifier?: string;
	system?: { identifier?: string };
	actor?: { uuid?: string; rules?: unknown } | null;
	rules?: Map<string, GrantActivationRuleLike> | null;
}

interface OfferTargetToken {
	actor?: { uuid?: string } | null;
}

function grantRulesOf(
	item: OfferGrantingItem,
	...triggers: GrantedActivationTrigger[]
): GrantActivationRuleLike[] {
	const rules =
		item.rules && typeof item.rules.values === 'function' ? [...item.rules.values()] : [];
	return rules.filter(
		(rule) =>
			rule?.type === GRANT_ACTIVATION_RULE_TYPE &&
			triggers.includes(rule.trigger ?? 'onActivation') &&
			rule.appliesTo?.(),
	);
}

function offerOf(
	rule: GrantActivationRuleLike,
	item: OfferGrantingItem,
	targetActorUuid: string,
	targeted = 0,
	extraTargets = 0,
): GrantedActionOffer {
	const targetCount = Math.max(0, Math.trunc(Number(rule.targetCount) || 0));
	return {
		id: foundry.utils.randomID(),
		targetActorUuid,
		label: ruleLabel({ label: rule.label, parentDocument: item }),
		activationType: rule.activationType ?? 'weaponAttack',
		ruleId: rule.id ?? '',
		sourceItemUuid: item.uuid ?? '',
		free: rule.free === true,
		spendsReaction: rule.spendsReaction === true,
		weaponKind: rule.weaponKind ?? 'any',
		allowsCantrips: rule.allowsCantrips === true,
		ignoresRushed: rule.ignoresRushed === true,
		condition: rule.condition ?? '',
		targetCount: targetCount > 0 ? targetCount + extraTargets : 0,
		targetedCount: targeted,
		afterMove: rule.trigger === 'afterMove',
		afterMoveCheck: rule.trigger === 'afterMove' ? (rule.afterMoveCheck ?? 'none') : 'none',
		afterMoveFlagKey: rule.afterMoveFlagKey ?? 'quarry',
		afterMoveMinEnemies: rule.afterMoveMinEnemies ?? 1,
		afterMoveStatus: rule.afterMoveStatus ?? '',
		used: false,
		usedBy: null,
		usedWith: null,
	};
}

/**
 * Build the granted-activation offers a used item extends to the user's
 * current targets, one offer per (rule, target actor). The activating actor
 * gets an offer from their own activation only when the rule says so, and the
 * targets get none when the rule is not for them. A line that waits for the
 * user's move is for the user alone. A rule's target count is reported on its
 * lines, not enforced: every target still gets a line.
 */
export function collectGrantedActionOffers(
	item: OfferGrantingItem,
	targets: OfferTargetToken[],
): GrantedActionOffer[] {
	const grantRules = grantRulesOf(item, 'onActivation', 'afterMove');
	if (grantRules.length < 1) return [];

	const sourceActorUuid = item.actor?.uuid ?? '';
	const identifier = identifierOf(item);
	const extraTargets = rulesOfType(item.actor, 'grantTargetBonus').reduce(
		(total, bonus) => total + bonus.bonusFor(identifier),
		0,
	);
	const offersByKey = new Map<string, GrantedActionOffer>();

	for (const rule of grantRules) {
		const afterMove = rule.trigger === 'afterMove';
		const includesUser = afterMove || rule.includesUser;
		const ruleTargets = afterMove || rule.includesTargets === false ? [] : targets;
		const targeted = new Set(
			ruleTargets
				.map((target) => target.actor?.uuid ?? '')
				.filter((uuid) => uuid && uuid !== sourceActorUuid),
		).size;
		const recipients = includesUser ? [{ actor: item.actor }, ...ruleTargets] : ruleTargets;
		for (const target of recipients) {
			const targetActorUuid = target.actor?.uuid ?? '';
			if (!targetActorUuid) continue;
			if (targetActorUuid === sourceActorUuid && !includesUser) continue;

			const key = `${rule.id ?? ''}:${targetActorUuid}`;
			if (offersByKey.has(key)) continue;

			offersByKey.set(key, offerOf(rule, item, targetActorUuid, targeted, extraTargets));
		}
	}

	return Array.from(offersByKey.values());
}

/**
 * The warnings to show when the item is used while a pool its rules need empty has charges. The
 * use goes on: the table decides.
 */
export function emptyPoolWarnings(
	item: OfferGrantingItem,
	poolOf: (identifier: string) => { label: string; current: number } | null,
): string[] {
	return grantRulesOf(item, 'onActivation', 'afterMove').flatMap((rule) => {
		const identifier = rule.emptyPoolIdentifier?.trim();
		const pool = identifier ? poolOf(identifier) : null;
		if (!pool || pool.current <= 0) return [];
		return [
			localize('NIMBLE.chat.grantedActionOffers.emptyPoolWarning', {
				item: item.name ?? '',
				pool: pool.label,
			}),
		];
	});
}

/** The lines the actor's own rules give them when they Interpose. */
export function collectInterposeOffers(
	actor: { uuid?: string; items?: Iterable<OfferGrantingItem> } | null | undefined,
): GrantedActionOffer[] {
	const actorUuid = actor?.uuid ?? '';
	if (!actorUuid) return [];
	return [...(actor?.items ?? [])].flatMap((item) =>
		grantRulesOf(item, 'onInterpose').map((rule) => offerOf(rule, item, actorUuid)),
	);
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
	usedWith: GrantedActionOfferUsedWith | null,
): Promise<void> {
	if (!game.user?.isGM) return;

	const message = getMessageById(messageId);
	if (!message?.update) return;

	const found = validateGrantedActionOffer(message, offerId, requestingUserId, viaSocket);
	if (!found) return;

	const updatedOffers = found.offers.map((entry) =>
		entry.id === offerId ? { ...entry, used: true, usedBy: requestingUserId, usedWith } : entry,
	);
	await message.update({
		system: { grantedActionOffers: updatedOffers },
	});
}

function usedWithOf(value: unknown): GrantedActionOfferUsedWith | null {
	if (!value || typeof value !== 'object') return null;
	const { name, uuid } = value as Partial<GrantedActionOfferUsedWith>;
	if (typeof name !== 'string' || !name) return null;
	return { name, uuid: typeof uuid === 'string' ? uuid : '' };
}

async function handleGrantedActionOfferRequest(payload: unknown): Promise<void> {
	if (!game.user?.isGM) return;
	if ((game.user.id ?? null) !== getPrimaryActiveGmId()) return;
	if (!payload || typeof payload !== 'object') return;

	const request = payload as Partial<GrantedActionOfferRequest>;
	if (request.type !== GRANTED_ACTION_OFFER_REQUEST_TYPE) return;
	if (!request.messageId || !request.offerId || !request.userId) return;

	await executeGrantedActionOfferUse(
		request.messageId,
		request.offerId,
		request.userId,
		true,
		usedWithOf(request.usedWith),
	);
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
	usedWith?: GrantedActionOfferUsedWith | null;
}): Promise<boolean> {
	if (!game.user?.id) return false;
	const usedWith = usedWithOf(params.usedWith);

	if (game.user.isGM) {
		await executeGrantedActionOfferUse(
			params.messageId,
			params.offerId,
			game.user.id,
			false,
			usedWith,
		);
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
		usedWith,
	});
	return true;
}

export type { GrantedActionOffer, GrantedActionOfferUsedWith };
