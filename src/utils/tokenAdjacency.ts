const ADJACENCY_THRESHOLD_SQUARES = 1.5;

function tokenCenter(token: Token): { x: number; y: number } {
	const gridSize = canvas?.grid?.size ?? 100;
	return {
		x: token.document.x + ((token.document.width ?? 1) * gridSize) / 2,
		y: token.document.y + ((token.document.height ?? 1) * gridSize) / 2,
	};
}

function isWithinAdjacencyRange(source: Token, candidate: Token): boolean {
	const gridSize = canvas?.grid?.size ?? 100;
	const threshold = ADJACENCY_THRESHOLD_SQUARES * gridSize;
	const a = tokenCenter(source);
	const b = tokenCenter(candidate);
	const dx = a.x - b.x;
	const dy = a.y - b.y;
	return Math.sqrt(dx * dx + dy * dy) <= threshold;
}

function getAdjacentTokens(source: Token, candidates: Token[]): Token[] {
	if (!canvas?.grid) return [];
	return candidates.filter(
		(candidate) => candidate !== source && isWithinAdjacencyRange(source, candidate),
	);
}

function countAdjacentByDisposition(token: Token, allTokens: Token[], disposition: number): number {
	const candidates = allTokens.filter((t) => t !== token && t.document.disposition === disposition);
	return getAdjacentTokens(token, candidates).length;
}

export { countAdjacentByDisposition, getAdjacentTokens };
