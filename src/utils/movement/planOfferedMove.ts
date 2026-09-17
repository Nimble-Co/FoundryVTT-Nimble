import type { MovementOffer, MovementOfferResult } from '#types/movement.js';
import { buildMovementRecord } from './buildMovementRecord.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

interface PlannableTokenDocument {
	isOwner: boolean;
	parent?: { grid?: { distance: number } } | null;
	object?: {
		planMovement(options: Record<string, unknown>): Promise<{ id: string } | null>;
	} | null;
	movement: { id: string; chain: readonly string[]; passed: { waypoints: readonly unknown[] } };
	startMovement(movementId: string): Promise<boolean>;
}

function planOptionsFor(offer: MovementOffer, gridDistance: number): Record<string, unknown> {
	const limit = offer.spaces * gridDistance;
	const options: Record<string, unknown> = {
		allowedActions: [offer.kind === 'forced' ? FORCED_MOVEMENT_ACTION : FREE_MOVEMENT_ACTION],
		// A push "away" or "toward" is one straight drag; a push in any
		// direction and every free move may bend around corners.
		direct: offer.kind === 'forced' && offer.direction !== 'any',
	};
	// Cost doubles in difficult terrain, distance does not: a free move that
	// honours terrain is capped by cost, every other offer by distance.
	if (offer.kind === 'free' && !offer.ignoreDifficultTerrain) {
		options.maxCost = limit;
	} else {
		options.maxDistance = limit;
		options.constrainOptions = { ignoreCost: true };
	}
	return options;
}

const DECLINED: MovementOfferResult = { outcome: 'declined', movedSpaces: null, stopped: false };
const UNAVAILABLE: MovementOfferResult = {
	outcome: 'unavailable',
	movedSpaces: null,
	stopped: false,
};

/**
 * Runs on the client of the user who drags: plans the constrained movement on
 * the canvas, starts it once the owner drops the token, and reports how far
 * it went. Declined when the owner dismisses the plan; unavailable when this
 * client cannot drag the token.
 */
export async function planOfferedMove(
	offer: MovementOffer,
	resolveToken: (uuid: string) => unknown = (uuid) =>
		fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0]),
): Promise<MovementOfferResult> {
	const token = resolveToken(offer.tokenUuid) as PlannableTokenDocument | null;
	const gridDistance = token?.parent?.grid?.distance;
	if (!token?.isOwner || !token.object || !gridDistance) return UNAVAILABLE;

	let plan: { id: string } | null;
	try {
		plan = await token.object.planMovement(planOptionsFor(offer, gridDistance));
	} catch {
		// Core throws for a hidden token a player cannot move or a canvas that is not ready.
		return UNAVAILABLE;
	}
	if (!plan) return DECLINED;

	// Resolves once the movement completed or was stopped short; false alone
	// does not mean nothing moved, so the movement state decides.
	await token.startMovement(plan.id);
	const movement = token.movement;
	const isThisPlan = movement.id === plan.id || movement.chain.includes(plan.id);
	if (!isThisPlan || movement.passed.waypoints.length === 0) return DECLINED;

	const record = buildMovementRecord(
		token as unknown as Parameters<typeof buildMovementRecord>[0],
		movement as unknown as Parameters<typeof buildMovementRecord>[1],
	);
	return {
		outcome: 'started',
		movedSpaces: record?.spaces ?? 0,
		stopped: record?.stopped ?? false,
	};
}
