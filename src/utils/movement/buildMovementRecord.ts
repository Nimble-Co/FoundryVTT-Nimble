import type { MovementRecord, TokenPosition } from '#types/movement.js';
import { type CombatLike, isInStartedCombat } from './isInStartedCombat.js';
import { measureWaypointSpaces } from './measureWaypointSpaces.js';
import { getMovementKind } from './movementKind.js';
import { readMovementOfferTag } from './movementOfferTag.js';
import { summariseMovementHistory } from './summariseMovementHistory.js';

interface Waypoint extends TokenPosition {
	action: string;
	movementId?: string | null;
	[key: string]: unknown;
}

interface MovementLike {
	id: string;
	chain: readonly string[];
	state: string;
	constrained: boolean;
	passed: { waypoints: readonly Waypoint[] };
	history: {
		recorded: { waypoints: readonly Waypoint[] };
		unrecorded: { waypoints: readonly Waypoint[] };
	};
	user: User;
	constrainOptions?: unknown;
}

interface RecordableToken {
	id: string | null;
	actor: Actor | null;
	movementHistory: readonly { action: string }[];
	parent?: { id?: string | null; grid?: { isGridless?: boolean; distance: number } } | null;
	measureMovementPath(waypoints: object[]): {
		segments: { distance: number; cost?: number; spaces: number }[];
	};
	getCompleteMovementPath(waypoints: object[]): TokenPosition[];
}

/**
 * Index of the chain's origin in the known waypoints. With no earlier history,
 * or after a gap, core writes the origin as a waypoint of the chain's first
 * movement; after a gap its action is "displace" and more waypoints of that
 * movement follow, which a one-waypoint teleport lacks. Else the origin is the
 * last waypoint before the chain.
 */
function findChainOrigin(known: readonly Waypoint[], start: number): number {
	if (start === 0) return 0;
	const first = known[start];
	const next = known[start + 1];
	const wroteOrigin = first.action === 'displace' && next?.movementId === first.movementId;
	return wroteOrigin ? start : start - 1;
}

function toPosition(waypoint: TokenPosition): TokenPosition {
	const { x, y, elevation, width, height, shape } = waypoint;
	return { x, y, elevation, width, height, shape };
}

/**
 * Builds the record of a finished Movement from Foundry's movement state. The
 * whole known history is measured once so alternating diagonal rules hold, and
 * only the segments belonging to this path's chain are counted. Returns null
 * when the movement carries no waypoints of its own.
 */
export function buildMovementRecord(
	token: RecordableToken,
	movement: MovementLike,
	combats?: Iterable<CombatLike>,
): MovementRecord | null {
	const lastPassed = movement.passed.waypoints.at(-1);
	if (!lastPassed) return null;

	const chainIds = new Set([...movement.chain, movement.id]);
	const known: Waypoint[] = [
		...movement.history.recorded.waypoints,
		...movement.history.unrecorded.waypoints,
		...movement.passed.waypoints,
	];
	const start = known.findIndex((waypoint) => chainIds.has(waypoint.movementId ?? ''));
	if (start === -1) return null;
	const originIndex = findChainOrigin(known, start);
	const origin = known[originIndex];

	const legs = measureWaypointSpaces(token, known);
	const costLegs = measureWaypointSpaces(token, known, 'cost');
	let spaces = 0;
	let costSpaces = 0;
	for (let index = originIndex; index < legs.length; index++) {
		const destination = known[index + 1];
		if (!chainIds.has(destination.movementId ?? '')) continue;
		if (getMovementKind(destination.action) === 'teleport') continue;
		spaces += legs[index];
		costSpaces += costLegs[index];
	}

	const path = token.getCompleteMovementPath(known.slice(originIndex)).map(toPosition);
	const inStartedCombat = isInStartedCombat(token, combats);

	return {
		token: token as unknown as TokenDocument,
		actor: token.actor,
		movementId: movement.chain[0] ?? movement.id,
		kind: getMovementKind(lastPassed.action),
		action: lastPassed.action,
		origin: toPosition(origin),
		stop: toPosition(lastPassed),
		path,
		spaces,
		costSpaces,
		spacesThisTurn: inStartedCombat
			? summariseMovementHistory(token, token.movementHistory).counted
			: null,
		stopped: movement.state === 'stopped' || movement.constrained,
		user: movement.user,
		offer: readMovementOfferTag(movement.constrainOptions),
	};
}
