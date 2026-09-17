import { SYSTEM_ID } from '#system';
import type { MovementOffer, MovementOfferRef, MovementOfferResult } from '#types/movement.js';
import { buildCardMovementOffer, type CardMovementOffer } from './buildCardMovementOffer.js';
import { planOfferedMove } from './planOfferedMove.js';

export const PLAN_MOVE_QUERY = `${SYSTEM_ID}.planMove`;

const QUERY_TIMEOUT_MS = 120_000;

const UNAVAILABLE: MovementOfferResult = {
	outcome: 'unavailable',
	movedSpaces: null,
	stopped: false,
};

interface MovingUser {
	id: string | null;
	active: boolean;
	isGM: boolean;
	isSelf: boolean;
	query(name: string, data: unknown, options: { timeout: number }): Promise<unknown>;
}

function ownsToken(user: MovingUser, card: CardMovementOffer): boolean {
	return (
		card.token.actor?.testUserPermission?.(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER) === true
	);
}

/**
 * The user who drags: this user when they own the token, else an active
 * player who owns it, else the active GM. Null when nobody connected can move
 * the token.
 */
export function selectMovingUser(
	card: CardMovementOffer,
	self: MovingUser | null,
	users: Iterable<MovingUser>,
	activeGm: MovingUser | null,
): MovingUser | null {
	if (self?.active && ownsToken(self, card)) return self;
	for (const user of users) {
		if (!user.active || user.isGM) continue;
		if (ownsToken(user, card)) return user;
	}
	return activeGm?.active ? activeGm : null;
}

/**
 * Offers a card's constrained drag to whoever should perform it. Plans locally
 * when that is this user, otherwise asks the owning client through a Foundry
 * user query that carries only the card, node and token ids. Resolves once
 * the drag lands, is dismissed, or cannot happen.
 */
export async function requestMove(
	ref: MovementOfferRef,
	deps: {
		resolveCard?: (ref: MovementOfferRef) => CardMovementOffer | null;
		self?: MovingUser | null;
		users?: Iterable<MovingUser>;
		activeGm?: MovingUser | null;
		planLocally?: (offer: MovementOffer) => Promise<MovementOfferResult>;
	} = {},
): Promise<MovementOfferResult> {
	const card = (deps.resolveCard ?? buildCardMovementOffer)(ref);
	if (!card) return UNAVAILABLE;

	const self = deps.self === undefined ? ((game.user as unknown as MovingUser) ?? null) : deps.self;
	const users = deps.users ?? ((game.users ?? []) as unknown as Iterable<MovingUser>);
	const activeGm =
		deps.activeGm === undefined
			? ((game.users as unknown as { activeGM?: MovingUser | null })?.activeGM ?? null)
			: deps.activeGm;
	const mover = selectMovingUser(card, self, users, activeGm);
	if (!mover) return UNAVAILABLE;

	if (mover.isSelf) return (deps.planLocally ?? planOfferedMove)(card.offer);

	try {
		const result = (await mover.query(PLAN_MOVE_QUERY, ref, {
			timeout: QUERY_TIMEOUT_MS,
		})) as Partial<MovementOfferResult> | null;
		if (result?.outcome !== 'started' && result?.outcome !== 'declined') return UNAVAILABLE;
		return {
			outcome: result.outcome,
			movedSpaces: result.movedSpaces ?? null,
			stopped: !!result.stopped,
		};
	} catch {
		return UNAVAILABLE;
	}
}
