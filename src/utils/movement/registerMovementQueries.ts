import type { MovementOffer, MovementOfferRef, MovementOfferResult } from '#types/movement.js';
import {
	buildCardMovementOffer,
	type CardMovementOffer,
	canUserTakeMovementOffer,
} from './buildCardMovementOffer.js';
import { planOfferedMove } from './planOfferedMove.js';
import { PLAN_MOVE_QUERY } from './requestMove.js';

const UNAVAILABLE: MovementOfferResult = {
	outcome: 'unavailable',
	movedSpaces: null,
	stopped: false,
};

/**
 * Answers a plan request on the owning client. The request names a card, a
 * node and a token; the offer is rebuilt here from the card, an offer already
 * taken is refused, and only the GM, the card's author or the token's owner
 * may ask.
 */
export async function handlePlanMoveQuery(
	data: unknown,
	context: { user?: { id: string | null; isGM: boolean } | null },
	deps: {
		resolveCard?: (ref: MovementOfferRef) => CardMovementOffer | null;
		canTake?: typeof canUserTakeMovementOffer;
		plan?: (offer: MovementOffer) => Promise<MovementOfferResult>;
	} = {},
): Promise<MovementOfferResult> {
	const ref = data as Partial<MovementOfferRef> | null;
	if (!ref?.messageId || !ref.nodeId || !ref.tokenUuid) return UNAVAILABLE;
	const card = (deps.resolveCard ?? buildCardMovementOffer)({
		messageId: ref.messageId,
		nodeId: ref.nodeId,
		tokenUuid: ref.tokenUuid,
	});
	if (!card || card.entry?.used) return UNAVAILABLE;
	if (!(deps.canTake ?? canUserTakeMovementOffer)(context.user, card)) return UNAVAILABLE;
	return (deps.plan ?? planOfferedMove)(card.offer);
}

/** Registers the user query that asks the owning client to plan an offered move. Runs at init. */
export function registerMovementQueries(): void {
	const config = CONFIG as unknown as {
		queries?: Record<string, (data: unknown, context: { user?: unknown }) => Promise<unknown>>;
	};
	config.queries ??= {};
	config.queries[PLAN_MOVE_QUERY] = (data, context) =>
		handlePlanMoveQuery(data, context as Parameters<typeof handlePlanMoveQuery>[1]);
}
