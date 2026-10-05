import type { MeasurableTokenDocument } from '#types/movement.js';
import { spacesBetween } from './spacesBetween.js';

/** Whether two tokens are on the same side. A neutral or secret token is on no side. */
export function areAllies(a: TokenDocument, b: TokenDocument): boolean {
	const { NEUTRAL, SECRET } = CONST.TOKEN_DISPOSITIONS;
	return a.disposition === b.disposition && a.disposition !== NEUTRAL && a.disposition !== SECRET;
}

/**
 * The visible allies of a token among the scene's tokens, within a number of
 * spaces. A range of 0 or less means every ally on the scene.
 */
export function alliesWithin(
	source: TokenDocument,
	sceneTokens: Iterable<TokenDocument>,
	within: number,
): TokenDocument[] {
	return [...sceneTokens].filter(
		(token) =>
			token !== source &&
			(token.id == null || token.id !== source.id) &&
			!token.hidden &&
			!!token.actor &&
			areAllies(source, token) &&
			(within <= 0 ||
				spacesBetween(
					source as unknown as MeasurableTokenDocument,
					token as unknown as MeasurableTokenDocument,
				) <= within),
	);
}
