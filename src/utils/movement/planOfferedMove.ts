import { SYSTEM_ID } from '#system';
import type { MovementOffer, MovementOfferOutcome } from '#types/movement.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

interface PlannableTokenDocument {
	isOwner: boolean;
	parent?: { grid?: { distance: number } } | null;
	object?: {
		planMovement(options: Record<string, unknown>): Promise<{ id: string } | null>;
	} | null;
	startMovement(movementId: string): Promise<boolean>;
}

/** The planMovement options an offer resolves to. Exported for tests only through planOfferedMove. */
function planOptionsFor(offer: MovementOffer, gridDistance: number): Record<string, unknown> {
	const limit = offer.spaces * gridDistance;
	const options: Record<string, unknown> = {
		allowedActions: [offer.kind === 'forced' ? FORCED_MOVEMENT_ACTION : FREE_MOVEMENT_ACTION],
		direct: offer.kind === 'forced',
		preventDrop: false,
		moveOptions: { [SYSTEM_ID]: { offerId: offer.id, messageId: offer.messageId } },
	};
	// Cost doubles in difficult terrain, distance does not: a free move that
	// honours terrain is capped by cost, every other offer by distance.
	if (offer.kind === 'free' && !offer.ignoreDifficultTerrain) options.maxCost = limit;
	else options.maxDistance = limit;
	return options;
}

/**
 * Runs on the client of the user who drags: plans the constrained movement on
 * the canvas and starts it once the owner drops the token. Declined when the
 * owner dismisses the plan; unavailable when this client cannot drag the token.
 */
export async function planOfferedMove(
	offer: MovementOffer,
	resolveToken: (uuid: string) => unknown = (uuid) =>
		fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0]),
): Promise<MovementOfferOutcome> {
	const token = resolveToken(offer.tokenUuid) as PlannableTokenDocument | null;
	if (!token?.isOwner || !token.object) return 'unavailable';

	const plan = await token.object.planMovement(
		planOptionsFor(offer, token.parent?.grid?.distance ?? 1),
	);
	if (!plan) return 'declined';
	return (await token.startMovement(plan.id)) ? 'started' : 'declined';
}
