import type { EffectNode } from '#types/effectTree.js';

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
	isSquare?: boolean;
	size: number;
	distance: number;
	measurePath(points: GridOffset[]): { distance: number };
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
	/** The Movement Offer the drag was made under, or null. */
	offer: MovementOfferTag | null;
}

export type MovementOfferKind = 'free' | 'forced';

/**
 * Open until the token's next Movement settles it, taken or left unused. In
 * combat an offer still open when its turn ends lapses.
 */
export type MovementOfferState = 'open' | 'taken' | 'unused' | 'lapsed';

/**
 * A Movement Offer as its card stores it: one per move node and recipient, with
 * the distance fixed when the offer is made. The system never moves the token;
 * the token's next drag is labelled with the offer and its ruler shows how far
 * the offer reaches.
 */
export interface MovementOffer {
	/** `<nodeId>.<tokenId>`, unique on its card. */
	id: string;
	nodeId: string;
	tokenUuid: string;
	/** The recipient's name when the offer was made. */
	name: string;
	kind: MovementOfferKind;
	/** Offered distance in spaces. */
	spaces: number;
	/** Always true for forced. Free moves set it per feature. */
	ignoreDifficultTerrain: boolean;
	state: MovementOfferState;
	/** The user whose Movement settled the offer. */
	usedBy: string | null;
	/** Spaces covered under the offer, never more than offered. Set when taken. */
	movedSpaces: number | null;
	/** A wall, terrain or the mover cut the Movement short. */
	stopped: boolean;
	/**
	 * Made under a save outcome, which the card does not track for each target.
	 * The card shows the distance, but no token carries the offer: it is never
	 * settled and never lapses.
	 */
	conditional: boolean;
}

/** Names one Movement Offer across cards: the card, and the offer on it. */
export interface MovementOfferTag {
	messageId: string;
	offerId: string;
}

/** The offer a token carries, with the card it is on. */
export interface ArmedMovementOffer extends MovementOffer {
	messageId: string;
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

/** The slice of an actor that works out a Movement Offer's distance. */
export interface OfferActor {
	getRollData(): Record<string, unknown>;
	system?: { attributes?: { movement?: { walk?: number }; sizeCategory?: string } };
}

/** The parts of a chat card that decide its Movement Offers. */
export interface OfferCard {
	id?: string | null;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null };
	system?: {
		targets?: string[];
		isCritical?: boolean;
		isMiss?: boolean;
		activation?: { effects?: EffectNode[] };
		movementOffers?: MovementOffer[];
	};
}

/** The slice of a core token ruler waypoint that marking a drag past an offer reads and marks. */
export interface OfferRulerWaypoint {
	stage: string;
	action: string;
	unreachable: boolean;
	measurement: { distance: number; cost: number };
}
