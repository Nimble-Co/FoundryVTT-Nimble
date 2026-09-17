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
	/** The Movement Offer this path answered, when it was an offered drag. */
	offerId: string | null;
	user: User;
}

export type MovementOfferKind = 'free' | 'forced';
export type MovementDirection = 'any' | 'away' | 'toward';
export type MovementChooser = 'mover' | 'source';

/**
 * A constrained drag offered to a token's owner. The system never moves the
 * token: the offer only sets the ruler's limit and the movement action.
 */
export interface MovementOffer {
	id: string;
	tokenUuid: string;
	kind: MovementOfferKind;
	/** Resolved maximum in spaces. The ruler shows it; the path is truncated to it. */
	spaces: number;
	/** Always true for forced. Free moves set it per feature. */
	ignoreDifficultTerrain: boolean;
	/** Shown on the card. Never enforced. */
	direction: MovementDirection;
	/** Who the book says picks the path. Shown on the card. */
	chooser: MovementChooser;
	label: string;
	/** The card that carries the offer, or null for a macro-driven move. */
	messageId: string | null;
}

export type MovementOfferOutcome = 'started' | 'declined' | 'unavailable';

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
