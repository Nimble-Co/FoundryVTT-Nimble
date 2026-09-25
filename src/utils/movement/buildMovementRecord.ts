import type { MovementRecord, TokenPosition } from '#types/movement.js';
import { measureWaypointSpaces } from './measureWaypointSpaces.js';
import { getMovementKind } from './movementKind.js';
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
	origin: TokenPosition;
	passed: { waypoints: readonly Waypoint[] };
	history: {
		recorded: { waypoints: readonly Waypoint[] };
		unrecorded: { waypoints: readonly Waypoint[] };
	};
	user: User;
}

interface RecordableToken {
	id: string | null;
	actor: Actor | null;
	movementHistory: readonly { action: string }[];
	parent?: { id?: string | null; grid?: { isGridless?: boolean; distance: number } } | null;
	measureMovementPath(waypoints: object[]): { segments: { distance: number; spaces: number }[] };
	getCompleteMovementPath(waypoints: object[]): TokenPosition[];
}

interface CombatLike {
	started?: boolean;
	combatants?: Iterable<{ tokenId: string | null; sceneId: string | null }>;
}

// Every started combat, not only the one this client views: the active GM may
// be looking at another scene.
function isInStartedCombat(token: RecordableToken, combats: Iterable<CombatLike>): boolean {
	const sceneId = token.parent?.id ?? null;
	for (const combat of combats) {
		if (!combat.started || !combat.combatants) continue;
		for (const combatant of combat.combatants) {
			if (combatant.tokenId === token.id && combatant.sceneId === sceneId) return true;
		}
	}
	return false;
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
	combats: Iterable<CombatLike> = (game.combats ?? []) as Iterable<CombatLike>,
): MovementRecord | null {
	const lastPassed = movement.passed.waypoints.at(-1);
	if (!lastPassed) return null;

	const chainIds = new Set([...movement.chain, movement.id]);
	const known: Waypoint[] = [
		...movement.history.recorded.waypoints,
		...movement.history.unrecorded.waypoints,
		...movement.passed.waypoints,
	];
	let start = known.findIndex((waypoint) => chainIds.has(waypoint.movementId ?? ''));
	if (start === -1) return null;
	if (start === 0) {
		known.unshift({ ...movement.origin, action: known[0].action, movementId: null });
		start = 1;
	}

	const legs = measureWaypointSpaces(token, known);
	let spaces = 0;
	for (let index = start - 1; index < legs.length; index++) {
		const destination = known[index + 1];
		if (!chainIds.has(destination.movementId ?? '')) continue;
		if (getMovementKind(destination.action) === 'teleport') continue;
		spaces += legs[index];
	}

	const path = token.getCompleteMovementPath(known.slice(start - 1)).map(toPosition);
	const inStartedCombat = isInStartedCombat(token, combats);

	return {
		token: token as unknown as TokenDocument,
		actor: token.actor,
		movementId: movement.chain[0] ?? movement.id,
		kind: getMovementKind(lastPassed.action),
		action: lastPassed.action,
		origin: toPosition(movement.origin),
		stop: toPosition(lastPassed),
		path,
		spaces,
		spacesThisTurn: inStartedCombat
			? summariseMovementHistory(token, token.movementHistory).counted
			: null,
		stopped: movement.state === 'stopped' || movement.constrained,
		user: movement.user,
	};
}
