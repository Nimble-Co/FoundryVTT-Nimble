import type { MovementKind } from '#types/movement.js';
import { FORCED_MOVEMENT_ACTION, FREE_MOVEMENT_ACTION } from './movementActions.js';

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
