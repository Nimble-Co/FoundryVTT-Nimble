export const ADJACENCY_QUALIFIER = {
	MOST: 'most',
} as const;

export type AdjacencyQualifier = (typeof ADJACENCY_QUALIFIER)[keyof typeof ADJACENCY_QUALIFIER];

// Map of token document ID → position override (x, y in canvas pixels).
// Used to pass the NEW position from an updateToken change before document.x/y is committed.
export type PositionOverrides = Map<string, { x: number; y: number }>;

// Two tokens are adjacent if their centers are within 1.5 grid squares of each other.
// This covers orthogonal adjacency (1.0 squares) and diagonal adjacency (≈1.41 squares).
const ADJACENCY_THRESHOLD_SQUARES = 1.5;

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

function areAdjacentOnGrid(
	tokenA: Token.Implementation,
	tokenB: Token.Implementation,
	overrides?: PositionOverrides,
): boolean {
	if (!canvas?.grid) return false;

	const threshold = ADJACENCY_THRESHOLD_SQUARES * canvas.grid.size;
	const a = tokenCenter(tokenA, overrides);
	const b = tokenCenter(tokenB, overrides);
	const dx = a.x - b.x;
	const dy = a.y - b.y;

	return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

function areEnemies(tokenA: Token.Implementation, tokenB: Token.Implementation): boolean {
	const dispA = tokenA.document.disposition;
	const dispB = tokenB.document.disposition;

	return (
		(dispA === CONST.TOKEN_DISPOSITIONS.HOSTILE && dispB !== CONST.TOKEN_DISPOSITIONS.HOSTILE) ||
		(dispB === CONST.TOKEN_DISPOSITIONS.HOSTILE && dispA !== CONST.TOKEN_DISPOSITIONS.HOSTILE)
	);
}

function countAdjacentEnemies(
	token: Token.Implementation,
	allTokens: Token.Implementation[],
	overrides?: PositionOverrides,
): number {
	return allTokens
		.filter((t) => t !== token)
		.filter((t) => areEnemies(token, t) && areAdjacentOnGrid(token, t, overrides)).length;
}

export { countAdjacentEnemies };
