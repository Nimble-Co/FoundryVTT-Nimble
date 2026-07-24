import { getAdjacencyIncludesDiagonals } from '../settings/adjacencySettings.js';

export const ADJACENCY_QUALIFIER = {
	MOST: 'most',
} as const;

export type AdjacencyQualifier = (typeof ADJACENCY_QUALIFIER)[keyof typeof ADJACENCY_QUALIFIER];

// Map of token document ID → position override (x, y in canvas pixels).
// Used to pass the NEW position from an updateToken change before document.x/y is committed.
export type PositionOverrides = Map<string, { x: number; y: number }>;

// Orthogonal range: centers up to 1 grid square apart per space (N/S/E/W).
const ORTHOGONAL_THRESHOLD_SQUARES_PER_SPACE = 1.0;

// Diagonal range: centers up to ≈1.41 grid squares apart per space (corners).
// 1.5 gives a small margin above √2 to avoid floating-point misses.
const DIAGONAL_THRESHOLD_SQUARES_PER_SPACE = 1.5;

function tokenCenter(
	token: Token.Implementation,
	overrides?: PositionOverrides,
): { x: number; y: number } {
	const gridSize = canvas?.grid?.size ?? 100;
	const override = overrides?.get(token.document.id ?? '');
	const baseX = override?.x ?? token.document.x;
	const baseY = override?.y ?? token.document.y;
	return {
		x: baseX + ((token.document.width ?? 1) * gridSize) / 2,
		y: baseY + ((token.document.height ?? 1) * gridSize) / 2,
	};
}

function areWithinSpaces(
	tokenA: Token.Implementation,
	tokenB: Token.Implementation,
	spaces: number,
	overrides?: PositionOverrides,
	includeDiagonals = getAdjacencyIncludesDiagonals(),
): boolean {
	if (!canvas?.grid) return false;

	const thresholdSquares =
		spaces *
		(includeDiagonals
			? DIAGONAL_THRESHOLD_SQUARES_PER_SPACE
			: ORTHOGONAL_THRESHOLD_SQUARES_PER_SPACE);
	const threshold = thresholdSquares * canvas.grid.size;
	const a = tokenCenter(tokenA, overrides);
	const b = tokenCenter(tokenB, overrides);
	const dx = a.x - b.x;
	const dy = a.y - b.y;

	return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

function areAdjacentOnGrid(
	tokenA: Token.Implementation,
	tokenB: Token.Implementation,
	overrides?: PositionOverrides,
	includeDiagonals = getAdjacencyIncludesDiagonals(),
): boolean {
	return areWithinSpaces(tokenA, tokenB, 1, overrides, includeDiagonals);
}

function areEnemies(tokenA: Token.Implementation, tokenB: Token.Implementation): boolean {
	const dispA = tokenA.document.disposition;
	const dispB = tokenB.document.disposition;

	return (
		(dispA === CONST.TOKEN_DISPOSITIONS.HOSTILE && dispB !== CONST.TOKEN_DISPOSITIONS.HOSTILE) ||
		(dispB === CONST.TOKEN_DISPOSITIONS.HOSTILE && dispA !== CONST.TOKEN_DISPOSITIONS.HOSTILE)
	);
}

// FRIENDLY, NEUTRAL, and SECRET all count as the non-HOSTILE side.
// Self-exclusion is handled by callers' t !== token filters.
function areAllies(tokenA: Token.Implementation, tokenB: Token.Implementation): boolean {
	const dispA = tokenA.document.disposition;
	const dispB = tokenB.document.disposition;

	return (
		(dispA === CONST.TOKEN_DISPOSITIONS.HOSTILE) === (dispB === CONST.TOKEN_DISPOSITIONS.HOSTILE)
	);
}

function countAdjacentEnemies(
	token: Token.Implementation,
	allTokens: Token.Implementation[],
	overrides?: PositionOverrides,
	includeDiagonals = getAdjacencyIncludesDiagonals(),
): number {
	return allTokens
		.filter((t) => t !== token)
		.filter((t) => areEnemies(token, t) && areAdjacentOnGrid(token, t, overrides, includeDiagonals))
		.length;
}

function countAdjacentAllies(
	token: Token.Implementation,
	allTokens: Token.Implementation[],
	overrides?: PositionOverrides,
	includeDiagonals = getAdjacencyIncludesDiagonals(),
): number {
	return allTokens
		.filter((t) => t !== token)
		.filter((t) => areAllies(token, t) && areAdjacentOnGrid(token, t, overrides, includeDiagonals))
		.length;
}

export { areAdjacentOnGrid, areAllies, areWithinSpaces, countAdjacentAllies, countAdjacentEnemies };
