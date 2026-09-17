/**
 * How the rules read a Movement. Regular and free are Regular Movement; forced
 * is Forced Movement; teleport is not Movement at all and never counts.
 */
export type MovementKind = 'regular' | 'free' | 'forced' | 'teleport';

export interface TokenPosition {
	x: number;
	y: number;
	elevation?: number;
	width?: number;
	height?: number;
	shape?: number;
}

export interface GridOffset {
	i: number;
	j: number;
	k?: number;
}

export interface MeasurableGrid {
	isGridless: boolean;
	size: number;
	measurePath(points: GridOffset[]): { spaces: number };
}

/** The slice of a TokenDocument that footprint-aware distance needs. */
export interface MeasurableTokenDocument {
	x: number;
	y: number;
	elevation?: number;
	width: number;
	height: number;
	shape?: number;
	parent?: { grid?: MeasurableGrid } | null;
	getOccupiedGridSpaceOffsets(data?: Partial<TokenPosition>): GridOffset[];
}

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

/** How a finished Movement changed the mover's position relative to an observer's Reach. */
export interface ReachChange {
	/** The mover was outside the observer's Reach at some step and inside at a later one. */
	entered: boolean;
	/** The mover was inside the observer's Reach at some step and outside at a later one. */
	left: boolean;
	insideAtOrigin: boolean;
	insideAtStop: boolean;
	/** A step of the path overlapped the observer's footprint. */
	passedThrough: boolean;
}
