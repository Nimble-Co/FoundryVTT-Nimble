function getAdjacentTokens(source: Token, candidates: Token[]): Token[] {
	const grid = canvas?.grid;
	if (!grid) return [];
	const sourceCoords = { x: source.document.x, y: source.document.y };
	return candidates.filter((candidate) => {
		if (candidate === source) return false;
		const candidateCoords = { x: candidate.document.x, y: candidate.document.y };
		return grid.testAdjacency(sourceCoords, candidateCoords);
	});
}

function countAdjacentByDisposition(token: Token, allTokens: Token[], disposition: number): number {
	const candidates = allTokens.filter((t) => t !== token && t.document.disposition === disposition);
	return getAdjacentTokens(token, candidates).length;
}

export { countAdjacentByDisposition, getAdjacentTokens };
