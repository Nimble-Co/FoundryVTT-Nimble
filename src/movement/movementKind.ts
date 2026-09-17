import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

/**
 * How the rules read a Movement. Regular and free are Regular Movement; forced
 * is Forced Movement; teleport is not Movement at all and never counts.
 */
export type MovementKind = 'regular' | 'free' | 'forced' | 'teleport';

export const MOVEMENT_KINDS_THAT_COUNT: readonly MovementKind[] = ['regular', 'free', 'forced'];

/** Maps a waypoint's movement action to its Movement kind. */
export function getMovementKind(action: string): MovementKind {
	if (action === FREE_MOVEMENT_ACTION) return 'free';
	if (action === FORCED_MOVEMENT_ACTION) return 'forced';
	if (action === 'displace') return 'teleport';
	const config = (CONFIG.Token?.movement?.actions as Record<string, { teleport?: boolean }>)?.[
		action
	];
	return config?.teleport ? 'teleport' : 'regular';
}
