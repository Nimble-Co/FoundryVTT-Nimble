import { SYSTEM_ID } from '#system';
import type { MovementOffer, MovementOfferOutcome } from '#types/movement.js';
import { planOfferedMove } from './planOfferedMove.js';

export const PLAN_MOVE_QUERY = `${SYSTEM_ID}.planMove`;

const QUERY_TIMEOUT_MS = 120_000;

interface MovingUser {
	id: string | null;
	active: boolean;
	isGM: boolean;
	isSelf: boolean;
	query(name: string, data: unknown, options: { timeout: number }): Promise<unknown>;
}

interface OfferedToken {
	actor?: { testUserPermission(user: unknown, level: number): boolean } | null;
}

/**
 * The user who drags: an active player who owns the token's actor first, then
 * the active GM. Null when nobody connected can move the token.
 */
export function selectMovingUser(
	token: OfferedToken,
	users: Iterable<MovingUser>,
	activeGm: MovingUser | null,
): MovingUser | null {
	for (const user of users) {
		if (!user.active || user.isGM) continue;
		if (token.actor?.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER)) return user;
	}
	return activeGm?.active ? activeGm : null;
}

/**
 * Offers a constrained drag for the token to whoever should perform it. Plans
 * locally when that is this user, otherwise asks the owning client through a
 * Foundry user query. Resolves once the drag lands, is dismissed, or cannot
 * happen.
 */
export async function requestMove(
	offer: MovementOffer,
	deps: {
		resolveToken?: (uuid: string) => unknown;
		users?: Iterable<MovingUser>;
		activeGm?: MovingUser | null;
		planLocally?: (offer: MovementOffer) => Promise<MovementOfferOutcome>;
	} = {},
): Promise<MovementOfferOutcome> {
	const resolveToken =
		deps.resolveToken ?? ((uuid) => fromUuidSync(uuid as Parameters<typeof fromUuidSync>[0]));
	const token = resolveToken(offer.tokenUuid) as OfferedToken | null;
	if (!token) return 'unavailable';

	const users = deps.users ?? ((game.users ?? []) as unknown as Iterable<MovingUser>);
	const activeGm =
		deps.activeGm === undefined
			? ((game.users as unknown as { activeGM?: MovingUser | null })?.activeGM ?? null)
			: deps.activeGm;
	const mover = selectMovingUser(token, users, activeGm);
	if (!mover) return 'unavailable';

	if (mover.isSelf) return (deps.planLocally ?? planOfferedMove)(offer);

	try {
		const outcome = await mover.query(PLAN_MOVE_QUERY, offer, { timeout: QUERY_TIMEOUT_MS });
		return outcome === 'started' || outcome === 'declined' ? outcome : 'unavailable';
	} catch {
		return 'unavailable';
	}
}
