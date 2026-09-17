import type { MovementKind } from './movementKind.js';
import type { TokenPosition } from './spacesBetween.js';

/**
 * One finished Movement: a token's whole path from its origin to its Stop,
 * built on every client once the last checkpoint lands or the path is stopped.
 */
export interface MovementRecord {
	token: TokenDocument;
	actor: Actor | null;
	/** Stable across checkpoints of one path: the first movement id in the chain. */
	movementId: string;
	kind: MovementKind;
	/** The movement action of the last waypoint. */
	action: string;
	origin: TokenPosition;
	stop: TokenPosition;
	/** Every position the token occupied, origin first and Stop last. Two entries for a teleport. */
	path: TokenPosition[];
	/** Spaces of this Movement alone. Zero for a teleport. */
	spaces: number;
	/** Spaces Moved This Turn including this Movement, or null when no history is recorded. */
	spacesThisTurn: number | null;
	/** True when a wall, terrain, the mover or a disconnect cut the path short. */
	stopped: boolean;
	user: User;
}
