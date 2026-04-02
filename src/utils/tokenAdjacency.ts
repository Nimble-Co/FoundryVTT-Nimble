const ADJACENCY_THRESHOLD_SQUARES = 1.5;

export type PositionOverrides = Map<string, { x: number; y: number }>;

function tokenCenter(token: Token, overrides?: PositionOverrides): { x: number; y: number } {
	const gridSize = canvas?.grid?.size ?? 100;
	const override = overrides?.get(token.document.id ?? '');
	const baseX = override?.x ?? token.document.x;
	const baseY = override?.y ?? token.document.y;
	return {
		x: baseX + ((token.document.width ?? 1) * gridSize) / 2,
		y: baseY + ((token.document.height ?? 1) * gridSize) / 2,
	};
}

function isWithinAdjacencyRange(
	source: Token,
	candidate: Token,
	overrides?: PositionOverrides,
): boolean {
	const gridSize = canvas?.grid?.size ?? 100;
	const threshold = ADJACENCY_THRESHOLD_SQUARES * gridSize;
	const a = tokenCenter(source, overrides);
	const b = tokenCenter(candidate, overrides);
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

function getAdjacentTokens(
	source: Token,
	candidates: Token[],
	overrides?: PositionOverrides,
): Token[] {
	if (!canvas?.grid) return [];
	return candidates.filter(
		(candidate) => candidate !== source && isWithinAdjacencyRange(source, candidate, overrides),
	);
}

function countAdjacentByDisposition(
	token: Token,
	allTokens: Token[],
	disposition: number,
	overrides?: PositionOverrides,
): number {
	const candidates = allTokens.filter((t) => t !== token && t.document.disposition === disposition);
	return getAdjacentTokens(token, candidates, overrides).length;
}

export { countAdjacentByDisposition, getAdjacentTokens };
