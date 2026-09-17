import type { MovementOffer } from '#types/movement.js';
import { planOfferedMove } from './planOfferedMove.js';
import { PLAN_MOVE_QUERY } from './requestMove.js';

/** Registers the user query that asks the owning client to plan an offered move. */
export function registerMovementQueries(): void {
	const config = CONFIG as unknown as {
		queries?: Record<string, (data: unknown) => Promise<unknown>>;
	};
	config.queries ??= {};
	config.queries[PLAN_MOVE_QUERY] = (data) => planOfferedMove(data as MovementOffer);
}
