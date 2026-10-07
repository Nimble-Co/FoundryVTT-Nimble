import type { MoveBandWaypoint, OfferRulerWaypoint } from '#types/movement.js';
import localize from '../localize.js';

/**
 * 3 is the most actions a turn can have, so a turn has at most 3 Moves. The
 * label shows the Move as one of the dice the sheet shows for the actions.
 */
const MOVE_ICONS = ['fa-dice-one', 'fa-dice-two', 'fa-dice-three'];
const MOVES_PER_TURN = MOVE_ICONS.length;

/** The CSS variables that hold the colours of the Moves, each a 6-digit hex colour. */
const MOVE_COLOR_VARIABLES = {
	2: '--nimble-ruler-move-2-color',
	3: '--nimble-ruler-move-3-color',
	over: '--nimble-ruler-move-over-color',
} as const;

/**
 * The colour of the spaces of the second Move, of the third Move, and of every
 * space past the third. The first Move keeps the user's colour.
 */
export type MoveColors = Partial<Record<keyof typeof MOVE_COLOR_VARIABLES, number>>;

/** Reads the colours of the Moves from the style sheet. A value that is not a hex colour is left out. */
export function readMoveColors(style: { getPropertyValue(name: string): string }): MoveColors {
	const colors: MoveColors = {};
	for (const [key, variable] of Object.entries(MOVE_COLOR_VARIABLES)) {
		const hex = /^#([0-9a-f]{6})$/i.exec(style.getPropertyValue(variable).trim())?.[1];
		if (hex) colors[key as unknown as keyof MoveColors] = Number.parseInt(hex, 16);
	}
	return colors;
}

/** The colour of the grid spaces of a drag waypoint, or undefined for the user's colour. */
export function moveColor(
	{ unreachable, moveBand }: Pick<MoveBandWaypoint, 'unreachable' | 'moveBand'>,
	colors: MoveColors,
): number | undefined {
	if (unreachable || !moveBand || moveBand < 2) return undefined;
	return moveBand > MOVES_PER_TURN ? colors.over : colors[moveBand as 2 | 3];
}

/** The die of the Move a drag waypoint falls in, and whether that is past the last Move of a turn. */
export function moveDie({
	moveBand,
}: Pick<MoveBandWaypoint, 'moveBand'>): { icon: string; over: boolean } | null {
	if (!moveBand) return null;
	return {
		icon: MOVE_ICONS[Math.min(moveBand, MOVES_PER_TURN) - 1],
		over: moveBand > MOVES_PER_TURN,
	};
}

/** Core dashes the line from the first drawn waypoint out of reach, so the last one in reach must be drawn. */
export function endsReach(waypoint: {
	unreachable: boolean;
	next?: { unreachable: boolean } | null;
}): boolean {
	return !waypoint.unreachable && !!waypoint.next?.unreachable;
}

/** Which offered movement a drag waypoint uses and how many of its spaces. */
export function budgetText({ offerBand }: Pick<OfferRulerWaypoint, 'offerBand'>): string {
	if (!offerBand) return '';
	return localize(`NIMBLE.movement.ruler.${offerBand.kind}`, {
		spaces: String(offerBand.spaces),
		limit: String(offerBand.limit),
	});
}
