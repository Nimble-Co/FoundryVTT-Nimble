import { attackCannotBeDefended, type DefendReactor, defendReactors } from './defendReactors.js';

/** What a hero asks for outside the card: a Defend, an Interpose, or both. */
export type DefendWay = 'defend' | 'interpose' | 'both';

type CardLike = {
	system: unknown;
	speaker?: { scene?: string | null; token?: string | null; actor?: string | null } | null;
	timestamp?: number | null;
};

function canDo(reactor: DefendReactor, way: DefendWay): boolean {
	if (reactor.defend) return false;
	if (way === 'defend') return reactor.targetTokenUuid !== null;
	return reactor.interposes.length > 0;
}

/**
 * The newest attack card of the running combat where the hero can still react in
 * that way, or null. A card made before the combat does not count.
 */
export function newestDefendCard<Card extends CardLike>(
	cards: readonly Card[],
	actor: Actor.Implementation,
	way: DefendWay,
	since: number,
): Card | null {
	for (let index = cards.length - 1; index >= 0; index--) {
		const card = cards[index];
		if (!card) continue;
		if ((card.timestamp ?? 0) < since) break;
		if (attackCannotBeDefended(card)) continue;
		const reactor = defendReactors(card).find((each) => each.actor.uuid === actor.uuid);
		if (reactor && canDo(reactor, way)) return card;
	}
	return null;
}
