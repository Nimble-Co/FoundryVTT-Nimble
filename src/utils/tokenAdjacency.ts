import type { MeasurableTokenDocument } from '#types/movement.js';
import { spacesBetween } from './movement/spacesBetween.js';

export const ADJACENCY_QUALIFIER = {
	MOST: 'most',
} as const;

export type AdjacencyQualifier = (typeof ADJACENCY_QUALIFIER)[keyof typeof ADJACENCY_QUALIFIER];

// Map of token document ID → position override (x, y in canvas pixels).
// Used to pass the NEW position from an updateToken change before document.x/y is committed.
export type PositionOverrides = Map<string, { x: number; y: number }>;

function measurable(token: Token.Implementation): MeasurableTokenDocument {
	return token.document as unknown as MeasurableTokenDocument;
}

function areWithinSpaces(
	tokenA: Token.Implementation,
	tokenB: Token.Implementation,
	spaces: number,
	overrides?: PositionOverrides,
): boolean {
	const positions = {
		a: overrides?.get(tokenA.document.id ?? ''),
		b: overrides?.get(tokenB.document.id ?? ''),
	};
	return spacesBetween(measurable(tokenA), measurable(tokenB), positions) <= spaces;
}

function areAdjacentOnGrid(
	tokenA: Token.Implementation,
	tokenB: Token.Implementation,
	overrides?: PositionOverrides,
): boolean {
	return areWithinSpaces(tokenA, tokenB, 1, overrides);
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
): number {
	return allTokens
		.filter((t) => t !== token)
		.filter((t) => areEnemies(token, t) && areAdjacentOnGrid(token, t, overrides)).length;
}

function countAdjacentAllies(
	token: Token.Implementation,
	allTokens: Token.Implementation[],
	overrides?: PositionOverrides,
): number {
	return allTokens
		.filter((t) => t !== token)
		.filter((t) => areAllies(token, t) && areAdjacentOnGrid(token, t, overrides)).length;
}

export { areAdjacentOnGrid, areAllies, areWithinSpaces, countAdjacentAllies, countAdjacentEnemies };
